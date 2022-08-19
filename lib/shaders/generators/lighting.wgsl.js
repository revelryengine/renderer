

import { LIGHT_TYPES } from '../../constants.js';
import { Environment } from '../../environment.js';
import { Lighting    } from '../../lighting.js';

import generateUniformBlock  from './uniform.wgsl.js';

const environmentUniformBlock = generateUniformBlock(Environment, 2, 4);
const lightingUniformBlock    = generateUniformBlock(Lighting, 2, 5);

export function generate({ flags }) {
    const M_PI = '3.141592653589793';
    const MAX_LIGHT_COUNT = 12;

    const code = /* wgsl */`
        @group(2) @binding(0) var envSampler: sampler;
        @group(2) @binding(1) var envLUT: texture_2d<f32>;
        @group(2) @binding(2) var envGGX: texture_cube<f32>;
        @group(2) @binding(3) var envCharlie: texture_cube<f32>;

        ${flags.useShadows ? /* wgsl */`
        @group(2) @binding(6) var shadowsTexture: texture_depth_2d_array;
        @group(2) @binding(7) var shadowsSampler: sampler_comparison;
        `: ''}

        ${flags.useTransmission ? /* wgsl */`
        @group(2) @binding(8) var transmissionTexture: texture_2d<f32>;
        `: ''}
        ${flags.useSSAO ? /* wgsl */`
        @group(2) @binding(9) var ssaoSampler: sampler;
        @group(2) @binding(10) var ssaoTexture: texture_2d<f32>;
        `: ''}

        ${environmentUniformBlock}
        ${lightingUniformBlock}

        struct LightInfo {
            specular     : vec3<f32>,
            diffuse      : vec3<f32>,
            irradiance   : vec3<f32>,
            sheen        : vec3<f32>,
            clearcoat    : vec3<f32>,
            transmission : vec3<f32>,
            occlusion    : f32,
        };

        fn getIrradiance(n: vec3<f32>) -> vec3<f32>{
            let c1 = 0.429043;
            let c2 = 0.511664;
            let c3 = 0.743125;
            let c4 = 0.886227;
            let c5 = 0.247708;

            var L00  = environment.irradianceCoefficients[0];
            var L1_1 = environment.irradianceCoefficients[1];
            var L10  = environment.irradianceCoefficients[2];
            var L11  = environment.irradianceCoefficients[3];
            var L2_2 = environment.irradianceCoefficients[4];
            var L2_1 = environment.irradianceCoefficients[5];
            var L20  = environment.irradianceCoefficients[6];
            var L21  = environment.irradianceCoefficients[7];
            var L22  = environment.irradianceCoefficients[8];

            return (
                c1 * L22 * (n.x * n.x - n.y * n.y) +
                c3 * L20 * n.z * n.z +
                c4 * L00 -
                c5 * L20 +
                2.0 * c1 * (L2_2 * n.x * n.y + L21 * n.x * n.z + L2_1 * n.y * n.z) +
                2.0 * c2 * (L11 * n.x + L1_1 * n.y + L10 * n.z)
            ) / vec3<f32>(${M_PI});
            //divide by pi for lambertian https://seblagarde.wordpress.com/2012/01/08/pi-or-not-to-pi-in-game-lighting-equation/
        }

        fn getLightInfo() -> LightInfo {
            var lightInfo: LightInfo;

            lightInfo.specular     = vec3<f32>(0.0);
            lightInfo.diffuse      = vec3<f32>(0.0);
            lightInfo.clearcoat    = vec3<f32>(0.0);
            lightInfo.sheen        = vec3<f32>(0.0);
            lightInfo.transmission = vec3<f32>(0.0);
            lightInfo.irradiance   = getIrradiance(normalInfo.n);

            return lightInfo;
        }

        var<private> lightInfo: LightInfo;

        fn getRangeAttenuation(range: f32, distance: f32) -> f32 {
            if (range <= 0.0) {
                return 1.0 / pow(distance, 2.0);
            }
            return max(min(1.0 - pow(distance / range, 4.0), 1.0), 0.0) / pow(distance, 2.0);
        }

        fn getSpotAttenuation(pointToLight: vec3<f32>, spotDirection: vec3<f32>, outerConeCos: f32, innerConeCos: f32) -> f32 {
            var actualCos = dot(normalize(spotDirection), normalize(-pointToLight));
            if (actualCos > outerConeCos) {
                if (actualCos < innerConeCos) {
                    return smoothstep(outerConeCos, innerConeCos, actualCos);
                }
                return 1.0;
            }
            return 0.0;
        }

        fn getLighIntensity(light: Light, pointToLight: vec3<f32>) -> vec3<f32> {
            var rangeAttenuation = 1.0;
            var spotAttenuation  = 1.0;

            if (light.lightType != ${LIGHT_TYPES.directional}) {
                rangeAttenuation = getRangeAttenuation(light.range, length(pointToLight));
            }
            if (light.lightType == ${LIGHT_TYPES.spot}) {
                spotAttenuation = getSpotAttenuation(pointToLight, light.direction, light.outerConeCos, light.innerConeCos);
            }
            return rangeAttenuation * spotAttenuation * light.intensity * light.color;
        }

        fn applyOcclusion(coord: vec2<f32>) {
            var ao = materialInfo.occlusion;

            ${flags.useSSAO ? /* wgsl */`
                ao = textureSample(ssaoTexture, ssaoSampler, coord.xy / vec2<f32>(frustum.width, frustum.height)).r;
            
                // for SSAO use min(ssao, materialInfo.occlusion) https://google.github.io/filament/Filament.md.html#toc5.6
                ${flags.hasTexture?.occlusionTexture ? /* wgsl */`
                    ao = min(ao, materialInfo.occlusion);
                `: ''}
            `: ''}

            lightInfo.diffuse   = mix(lightInfo.diffuse   * ao, lightInfo.diffuse  , material.occlusionStrength);
            lightInfo.specular  = mix(lightInfo.specular  * ao, lightInfo.specular , material.occlusionStrength);
            lightInfo.sheen     = mix(lightInfo.sheen     * ao, lightInfo.sheen    , material.occlusionStrength);
            lightInfo.clearcoat = mix(lightInfo.clearcoat * ao, lightInfo.clearcoat, material.occlusionStrength);
            lightInfo.occlusion = ao;
        }

        fn getIBLRadianceGGX(n: vec3<f32>, v: vec3<f32>, roughness: f32, F0: vec3<f32>, specularWeight: f32) -> vec3<f32>{
            var NdotV = clampedDot(n, v);
            var lod = roughness * f32(environment.mipLevelCount - 1);
            var reflection = normalize(reflect(-v, n));

            var brdfSamplePoint = clamp(vec2<f32>(NdotV, roughness), vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0));
            var f_ab = textureSample(envLUT, envSampler, brdfSamplePoint).rg;
            var specularSample = textureSampleLevel(envGGX, envSampler, reflection, lod);

            var specularLight = specularSample.rgb;

            // see https://bruop.github.io/ibl/#single_scattering_results at Single Scattering Results
            // Roughness dependent fresnel, from Fdez-Aguera
            var Fr = max(vec3<f32>(1.0 - roughness), F0) - F0;
            var k_S = F0 + Fr * pow(1.0 - NdotV, 5.0);

            ${flags.hasExtension.KHR_materials_iridescence ? /* glsl */`
            k_S = mix(k_S, materialInfo.iridescenceFresnel, materialInfo.iridescenceFactor);
            `: ''}
            var FssEss = k_S * f_ab.x + f_ab.y;

            return specularWeight * specularLight * FssEss;
        }


        fn getIBLRadianceLambertian(n: vec3<f32>, v: vec3<f32>, roughness: f32, diffuseColor: vec3<f32>, F0: vec3<f32>, specularWeight: f32) -> vec3<f32> {
            var NdotV = clampedDot(n, v);
            var brdfSamplePoint = clamp(vec2<f32>(NdotV, roughness), vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0));
            var f_ab = textureSample(envLUT, envSampler, brdfSamplePoint).rg;

            var irradiance = lightInfo.irradiance;

            ${flags.hasExtension.KHR_materials_iridescence ? /* wgsl */`
            // Use the maximum component of the iridescence Fresnel color
            // Maximum is used instead of the RGB value to not get inverse colors for the diffuse BRDF
            var iridescenceF0Max = vec3<f32>(max(max(materialInfo.iridescenceF0.r, materialInfo.iridescenceF0.g), materialInfo.iridescenceF0.b));

            // Blend between base F0 and iridescence F0
            var _F0 = mix(F0, iridescenceF0Max, materialInfo.iridescenceFactor);
            `: /* wgsl */`
            var _F0 = F0;
            `}

            // see https://bruop.github.io/ibl/#single_scattering_results at Single Scattering Results
            // Roughness dependent fresnel, from Fdez-Aguera

            var Fr = max(vec3<f32>(1.0 - roughness), _F0) - _F0;
            var k_S = _F0 + Fr * pow(1.0 - NdotV, 5.0);
            var FssEss = specularWeight * k_S * f_ab.x + f_ab.y; // <--- GGX / specular light contribution (scale it down if the specularWeight is low)

            // Multiple scattering, from Fdez-Aguera
            var Ems = (1.0 - (f_ab.x + f_ab.y));
            var F_avg = specularWeight * (_F0 + (1.0 - _F0) / 21.0);
            var FmsEms = Ems * FssEss * F_avg / (1.0 - F_avg * Ems);
            var k_D = diffuseColor * (1.0 - FssEss + FmsEms); // we use +FmsEms as indicated by the formula in the blog post (might be a typo in the implementation)

            return (FmsEms + k_D) * irradiance;
        }

        fn getIBLRadianceCharlie(n: vec3<f32>, v: vec3<f32>, sheenRoughness: f32, sheenColor: vec3<f32>) -> vec3<f32> {
            var NdotV = clampedDot(n, v);
            var lod = sheenRoughness * f32(environment.mipLevelCount - 1);
            var reflection = normalize(reflect(-v, n));

            var brdfSamplePoint = clamp(vec2<f32>(NdotV, sheenRoughness), vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0));
            var brdf = textureSample(envLUT, envSampler, brdfSamplePoint).b;
            var sheenSample = textureSampleLevel(envCharlie, envSampler, reflection, lod);

            var sheenLight = sheenSample.rgb;
            return sheenLight * sheenColor * brdf;
        }

        fn getPunctualRadianceClearCoat(clearcoatNormal: vec3<f32>, v: vec3<f32>, l: vec3<f32>, h: vec3<f32>, VdotH: f32, f0: vec3<f32>, f90: vec3<f32>, clearcoatRoughness: f32) -> vec3<f32> {
            var NdotL = clampedDot(clearcoatNormal, l);
            var NdotV = clampedDot(clearcoatNormal, v);
            var NdotH = clampedDot(clearcoatNormal, h);
            return NdotL * BRDF_specularGGX(f0, f90, clearcoatRoughness * clearcoatRoughness, 1.0, VdotH, NdotL, NdotV, NdotH);
        }

        fn getPunctualRadianceSheen(sheenColor: vec3<f32>, sheenRoughness: f32, NdotL: f32, NdotV: f32, NdotH: f32) -> vec3<f32> {
            return NdotL * BRDF_specularSheen(sheenColor, sheenRoughness, NdotL, NdotV, NdotH);
        }

        fn applyIorToRoughness(roughness: f32, ior: f32) -> f32 {
            // Scale roughness with IOR so that an IOR of 1.0 results in no microfacet refraction and
            // an IOR of 1.5 results in the default amount of microfacet refraction.
            return roughness * clamp(ior * 2.0 - 2.0, 0.0, 1.0);
        }

        fn getPunctualRadianceTransmission(normal: vec3<f32>, view: vec3<f32>, pointToLight: vec3<f32>, alphaRoughness: f32, f0: vec3<f32>, f90: vec3<f32>, baseColor: vec3<f32>, ior: f32) -> vec3<f32> {
            var transmissionRoughness = applyIorToRoughness(alphaRoughness, ior);
        
            var n = normalize(normal);           // Outward direction of surface point
            var v = normalize(view);             // Direction from surface point to view
            var l = normalize(pointToLight);
            var l_mirror = normalize(l + 2.0*n*dot(-l, n));     // Mirror light reflection vector on surface
            var h = normalize(l_mirror + v);            // Halfway vector between transmission light vector and v
        
            var D   = D_GGX(clamp(dot(n, h), 0.0, 1.0), transmissionRoughness);
            var F   = F_Schlick_3(f0, f90, clamp(dot(v, h), 0.0, 1.0));
            var Vis = V_GGX(clamp(dot(n, l_mirror), 0.0, 1.0), clamp(dot(n, v), 0.0, 1.0), transmissionRoughness);
        
            // Transmission BTDF
            return (1.0 - F) * baseColor.rgb * D * Vis;
        }

        // Compute attenuated light as it travels through a volume.
        fn applyVolumeAttenuation(radiance: vec3<f32>, transmissionDistance: f32, attenuationColor: vec3<f32>, attenuationDistance: f32) -> vec3<f32>{
            // Compute light attenuation using Beer's law.
            var attenuationCoefficient = -log(attenuationColor) / attenuationDistance;
            var transmittance = exp(-attenuationCoefficient * transmissionDistance); // Beer's law
            return select(transmittance * radiance, radiance, attenuationDistance == 0.0); // Attenuation distance is +∞ (which we indicate by zero), i.e. the transmitted color is not attenuated at all.
        }


        fn getVolumeTransmissionRay(n: vec3<f32>, v: vec3<f32>, thickness: f32, ior: f32, modelScale: vec3<f32>) -> vec3<f32>{
            // Direction of refracted light.
            var refractionVector = refract(-v, normalize(n), 1.0 / ior);

            // The thickness is specified in local space.
            return normalize(refractionVector) * thickness * modelScale;
        }

        fn getTransmissionSample(fragCoord: vec2<f32>, roughness: f32, ior: f32) -> vec3<f32> {
            ${flags.useTransmission ? /* wgsl */`
            var framebufferLod  = log2(f32(textureDimensions(transmissionTexture, 0).x)) * applyIorToRoughness(roughness, ior);
            var transmittedLight = textureSampleLevel(transmissionTexture, envSampler, fragCoord.xy, framebufferLod).rgb;
            return transmittedLight;
            `: /* wgsl */`
            return vec3<f32>(0.0);
            `}
        }

        fn getIBLVolumeRefraction(n: vec3<f32>, v: vec3<f32>, perceptualRoughness: f32, baseColor: vec3<f32>, f0: vec3<f32>, f90: vec3<f32>, position: vec3<f32>, modelScale: vec3<f32>, viewMatrix: mat4x4<f32>, projMatrix: mat4x4<f32>, ior: f32, thickness: f32, attenuationColor: vec3<f32>, attenuationDistance: f32) -> vec3<f32> {
            var transmissionRay = getVolumeTransmissionRay(n, v, thickness, ior, modelScale);
            var refractedRayExit = position + transmissionRay;

            // Project refracted vector on the framebuffer, while mapping to normalized device coordinates.
            var ndcPos = projMatrix * viewMatrix * vec4<f32>(refractedRayExit, 1.0);
            var refractionCoords = vec2<f32>(ndcPos.x, -ndcPos.y) / ndcPos.w;
            refractionCoords = refractionCoords + 1.0;
            refractionCoords = refractionCoords / 2.0;

            // Sample framebuffer to get pixel the refracted ray hits.
            var transmittedLight = getTransmissionSample(refractionCoords, perceptualRoughness, ior);

            var attenuatedColor = applyVolumeAttenuation(transmittedLight, length(transmissionRay), attenuationColor, attenuationDistance);

            // Sample GGX LUT to get the specular component.
            var NdotV = clampedDot(n, v);
            var brdfSamplePoint = clamp(vec2<f32>(NdotV, perceptualRoughness), vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0));
            var brdf = textureSample(envLUT, envSampler, brdfSamplePoint).rg;
            var specularColor = f0 * brdf.x + f90 * brdf.y;

            return (1.0 - specularColor) * attenuatedColor * baseColor.rgb;
        }

        fn getLinearDepth(d: f32) -> f32 {
            return frustum.near * frustum.far / (frustum.far + d * (frustum.near - frustum.far));
        }

        fn getShadowCascade() -> vec2<f32> {
            var layer = 0;
            var blend = 0.0;
            var depth = getLinearDepth(in.gl_FragCoord.z * 0.5 + 0.5);
            for(var i = 0; i < lighting.shadowCascadeCount; i++) {
                var z = lighting.shadowCascadeDepths[i];
                layer = i;
                if(depth < z) {
                    blend = smoothstep(0.95, 1.0, depth / z);  
                    break;
                }
            }
            return vec2<f32>(f32(layer), blend);
        }

        ${flags.useShadows ? /* wgsl */`

            // ------------ported from filament ------------------------------------------------
            // @see https://github.com/google/filament/blob/a0af0a98cb471cdb67dcd67951e3d34e7f44ac54/shaders/src/shadowing.fs

            fn sampleDepth(layer: i32, uv: vec2<f32>, depth: f32) -> f32 {
                // depth must be clamped to support floating-point depth formats. This is to avoid comparing a
                // value from the depth texture (which is never greater than 1.0) with a greater-than-one
                // comparison value (which is possible with floating-point formats).
                var d = textureGatherCompare(shadowsTexture, shadowsSampler, uv, layer, saturate(depth));
                return (d[0] + d[1] + d[2] + d[3]) / 4.0;
            }

            fn shadowPCF(layer: i32, bias: f32)  -> f32 {
                var texcoord = shadowTexcoords[layer];

                texcoord.z = texcoord.z - bias;
                var position = texcoord.xyz / texcoord.w;

                // note: shadowPosition.z is in the [1, 0] range (reversed Z)
                var size = vec2<f32>(textureDimensions(shadowsTexture, 0));
                var texelSize = vec2<f32>(1.0) / size;
            
                //  Castaño, 2013, "Shadow Mapping Summary Part 1"
                var depth = position.z;
            
                // clamp position to avoid overflows below, which cause some GPUs to abort
                position = vec3<f32>(clamp(position.xy, vec2<f32>(-1.0), vec2<f32>(2.0)), position.z);
            
                var offset = vec2<f32>(0.5);
                var uv     = (position.xy * size) + offset;
                var base   = (floor(uv) - offset) * texelSize;
                var st     = fract(uv);
            
                var uw = vec2<f32>(3.0 - 2.0 * st.x, 1.0 + 2.0 * st.x);
                var vw = vec2<f32>(3.0 - 2.0 * st.y, 1.0 + 2.0 * st.y);
            
                var u = vec2<f32>((2.0 - st.x) / uw.x - 1.0, st.x / uw.y + 1.0);
                var v = vec2<f32>((2.0 - st.y) / vw.x - 1.0, st.y / vw.y + 1.0);
            
                u = u * texelSize.x;
                v = v * texelSize.y;
            
                var sum = 0.0;
                
                sum = sum + (uw.x * vw.x * sampleDepth(layer, base + vec2<f32>(u.x, v.x), depth));
                sum = sum + (uw.y * vw.x * sampleDepth(layer, base + vec2<f32>(u.y, v.x), depth));
                sum = sum + (uw.x * vw.y * sampleDepth(layer, base + vec2<f32>(u.x, v.y), depth));
                sum = sum + (uw.y * vw.y * sampleDepth(layer, base + vec2<f32>(u.y, v.y), depth));
                return sum * (1.0 / 16.0);
            }
            //-----------------------------------------------------------------------------------------------

            fn getShadowFactor(light: Light, NdotL: f32) -> f32 {
                if(light.lightType == ${LIGHT_TYPES.point}) {
                    return 1.0;
                }

                var layer = light.shadowLayer;
                var blend = 0.0;
                var bias  = clamp(0.0005 * tan(acos(NdotL)), 0.0, 0.001); //apply slight additional bias to reduce artifacts

                if(light.lightType == ${LIGHT_TYPES.directional}) {
                    var shadowCascade = getShadowCascade();
                    layer = layer + i32(shadowCascade.x);
                    blend = shadowCascade.y;
                }
                
                if(blend > 0.0) {
                    var nearShadow = shadowPCF(layer, bias);
                    var farShadow  = shadowPCF(layer + 1, bias);
                    return mix(nearShadow, farShadow, blend);
                } else {
                    return shadowPCF(layer, bias);
                }
            }
        `: /* wgsl */`
            fn getShadowFactor(light: Light, NdotL: f32) -> f32{
                return 1.0;
            }
        `}

        fn applyPunctualLights(){
            var v = normalInfo.v;
            var n = normalInfo.n;

            var NdotV = clampedDot(n, v);
            
            for (var i = 0; i < lighting.lightCount; i = i + 1) {

                var light = lighting.lights[i];

                var pointToLight: vec3<f32>;
                if (light.lightType != ${LIGHT_TYPES.directional}) {
                    pointToLight = light.position - in.position;
                } else {
                    pointToLight = -light.direction;
                }

                var l = normalize(pointToLight);   // Direction from surface point to light
                var h = normalize(l + v);          // Direction of the vector between l and v, called halfway vector
                var NdotL = clampedDot(n, l);
                var NdotH = clampedDot(n, h);
                var LdotH = clampedDot(l, h);
                var VdotH = clampedDot(v, h);
                if (NdotL > 0.0 || NdotV > 0.0) {
                    var shadow = getShadowFactor(light, NdotL);
                    var intensity = getLighIntensity(light, pointToLight) * shadow;

                    ${flags.hasExtension.KHR_materials_iridescence ? /* wgsl */`
                    lightInfo.diffuse  = lightInfo.diffuse  + intensity * NdotL * BRDF_lambertianIridescence(materialInfo.f0, materialInfo.f90, materialInfo.c_diff, materialInfo.specularWeight, VdotH, materialInfo.iridescenceFresnel, materialInfo.iridescenceFactor);
                    lightInfo.specular = lightInfo.specular + intensity * NdotL * BRDF_specularGGXIridescence(materialInfo.f0, materialInfo.f90, materialInfo.alphaRoughness, materialInfo.specularWeight, VdotH, NdotL, NdotV, NdotH, materialInfo.iridescenceFresnel, materialInfo.iridescenceFactor);
                    `: /* wgsl */`
                    lightInfo.diffuse  = lightInfo.diffuse  + intensity * NdotL * BRDF_lambertian(materialInfo.f0, materialInfo.f90, materialInfo.c_diff, materialInfo.specularWeight, VdotH);
                    lightInfo.specular = lightInfo.specular + intensity * NdotL * BRDF_specularGGX(materialInfo.f0, materialInfo.f90, materialInfo.alphaRoughness, materialInfo.specularWeight, VdotH, NdotL, NdotV, NdotH);
                    `}

                    ${flags.hasExtension?.KHR_materials_sheen ? /* wgsl */`
                        lightInfo.sheen = lightInfo.sheen + intensity * getPunctualRadianceSheen(materialInfo.sheenColorFactor, materialInfo.sheenRoughnessFactor, NdotL, NdotV, NdotH);
                        // lightInfo.sheenScaling = min(1.0 - max3(materialInfo.sheenColorFactor) * albedoSheenScalingLUT(NdotV, materialInfo.sheenRoughnessFactor), 1.0 - max3(materialInfo.sheenColorFactor) * albedoSheenScalingLUT(NdotL, materialInfo.sheenRoughnessFactor));
                    `: ''}

                    ${flags.hasExtension?.KHR_materials_clearcoat ? /* wgsl */`
                        lightInfo.clearcoat = lightInfo.clearcoat + intensity * getPunctualRadianceClearCoat(materialInfo.clearcoatNormal, v, l, h, VdotH, materialInfo.clearcoatF0, materialInfo.clearcoatF90, materialInfo.clearcoatRoughness);
                    `: ''}
                }

                ${flags.hasExtension?.KHR_materials_transmission ? /* wgsl */`
                    // If the light ray travels through the geometry, use the point it exits the geometry again.
                    // That will change the angle to the light source, if the material refracts the light ray.
                    var transmissionRay = getVolumeTransmissionRay(n, v, materialInfo.thickness, materialInfo.ior, in.modelScale);
                    pointToLight = pointToLight - transmissionRay;
                    l = normalize(pointToLight);

                    var intensity = getLighIntensity(light, pointToLight);
                    var transmittedLight = intensity * getPunctualRadianceTransmission(n, v, l, materialInfo.alphaRoughness, materialInfo.f0, materialInfo.f90, materialInfo.c_diff, materialInfo.ior);

                    ${flags.hasExtension?.KHR_materials_volume ? /* wgsl */`
                    transmittedLight = applyVolumeAttenuation(transmittedLight, length(transmissionRay), materialInfo.attenuationColor, materialInfo.attenuationDistance);
                    `: ''}

                    lightInfo.transmission = lightInfo.transmission + transmittedLight;
                `: ''}
            }
        }

        fn applyEnvironment() {
            var n = normalInfo.n;
            var v = normalInfo.v;

            lightInfo.specular = lightInfo.specular + getIBLRadianceGGX(n, v, materialInfo.perceptualRoughness, materialInfo.f0, materialInfo.specularWeight);
            lightInfo.diffuse  = lightInfo.diffuse + getIBLRadianceLambertian(n, v, materialInfo.perceptualRoughness, materialInfo.c_diff, materialInfo.f0, materialInfo.specularWeight);
            
            ${flags.hasExtension?.KHR_materials_sheen ? /* wgsl */`
                lightInfo.sheen = lightInfo.sheen + getIBLRadianceCharlie(n, v, materialInfo.sheenRoughnessFactor, materialInfo.sheenColorFactor);
            `: ''}

            ${flags.hasExtension?.KHR_materials_clearcoat ? /* wgsl */`
                lightInfo.clearcoat = lightInfo.clearcoat + getIBLRadianceGGX(materialInfo.clearcoatNormal, v, materialInfo.clearcoatRoughness, materialInfo.clearcoatF0, 1.0);
            `: ''}
        }

        fn applyTransmission() {
            var n = normalInfo.n;
            var v = normalInfo.v;
            ${flags.hasExtension?.KHR_materials_transmission ? /* wgsl */`
                lightInfo.transmission = lightInfo.transmission + getIBLVolumeRefraction(
                    n, v,
                    materialInfo.perceptualRoughness,
                    materialInfo.c_diff, materialInfo.f0, materialInfo.f90,
                    in.position, in.modelScale, frustum.viewMatrix, frustum.projectionMatrix,
                    materialInfo.ior, materialInfo.thickness, materialInfo.attenuationColor, materialInfo.attenuationDistance);
            `: ''}
        }

        fn applyLighting() -> vec4<f32> {
            var color = vec3<f32>(0.0);

            var albedoSheenScaling = 1.0;

            ${flags.hasExtension?.KHR_materials_transmission ? /* wgsl */`
            var diffuse = mix(lightInfo.diffuse, lightInfo.transmission, materialInfo.transmissionFactor);
            `: /* wgsl */`
            var diffuse = lightInfo.diffuse;
            `}

            color = materialInfo.emissive + diffuse + lightInfo.specular;
            color = lightInfo.sheen + color * albedoSheenScaling;
            color = color * (1.0 - materialInfo.clearcoatFactor * materialInfo.clearcoatFresnel) + (lightInfo.clearcoat * materialInfo.clearcoatFactor);

            return vec4<f32>(color, materialInfo.baseColor.a);
        }

        fn applyToneMap(color: vec3<f32>) -> vec3<f32> {
            var c = color * environment.exposure;

            ${flags.tonemap === 'Aces Narkowicz' ? /* wgsl */`
                c = toneMapACES_Narkowicz(c);
            `: ''}

            ${flags.tonemap === 'Aces Hill' ? /* wgsl */`
                c = toneMapACES_Hill(c);
            `: ''}

            ${flags.tonemap === 'Aces Hill Exposure Boost' ? /* wgsl */`
                // boost exposure as discussed in https://github.com/mrdoob/three.js/pull/19621
                // this factor is based on the exposure correction of Krzysztof Narkowicz in his
                // implemetation of ACES tone mapping
                c = toneMapACES_Hill(c / 0.6);
            `: ''}

            return c;
        }
    `;

    return code;
}

export default generate;
