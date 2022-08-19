

import { LIGHT_TYPES } from '../../constants.js';
import { Environment } from '../../environment.js';
import { Lighting    } from '../../lighting.js';


import generateUniformBlock  from './uniform.glsl.js';

const environmentUniformBlock = generateUniformBlock(Environment, 2, 4);
const lightingUniformBlock    = generateUniformBlock(Lighting, 2, 5);

export function generate({ flags }) {
    const M_PI = '3.141592653589793';
    const MAX_LIGHT_COUNT = 12;

    const code = /* glsl */`
        #pragma revTextureBinding(envLUT, 2, 1, 0)
        uniform sampler2D envLUT;
        
        #pragma revTextureBinding(envGGX, 2, 2, 0)
        uniform samplerCube envGGX;

        #pragma revTextureBinding(envCharlie, 2, 3, 0)
        uniform samplerCube envCharlie;

        ${flags.useShadows ? /* glsl */`
        precision highp sampler2DArrayShadow;
        #pragma revTextureBinding(shadowsTexture, 2, 6, 7)
        uniform sampler2DArrayShadow shadowsTexture;
        `: ''}

        ${flags.useTransmission ? /* glsl */`
        #pragma revTextureBinding(transmissionTexture, 2, 8, 0)
        uniform sampler2D transmissionTexture;
        `: ''}

        ${flags.useSSAO ? /* glsl */`
        #pragma revTextureBinding(ssaoTexture, 2, 10, 9)
        uniform sampler2D ssaoTexture;
        `: ''}

        ${environmentUniformBlock}
        ${lightingUniformBlock}
        
        struct LightInfo {
            vec3 specular;
            vec3 diffuse;
            vec3 irradiance;
            vec3 sheen;
            vec3 clearcoat;
            vec3 transmission;
            float occlusion;
        };

        vec3 getIrradiance(vec3 n) {
            const float c1 = 0.429043;
            const float c2 = 0.511664;
            const float c3 = 0.743125;
            const float c4 = 0.886227;
            const float c5 = 0.247708;

            vec3 L00  = environment.irradianceCoefficients[0];
            vec3 L1_1 = environment.irradianceCoefficients[1];
            vec3 L10  = environment.irradianceCoefficients[2];
            vec3 L11  = environment.irradianceCoefficients[3];
            vec3 L2_2 = environment.irradianceCoefficients[4];
            vec3 L2_1 = environment.irradianceCoefficients[5];
            vec3 L20  = environment.irradianceCoefficients[6];
            vec3 L21  = environment.irradianceCoefficients[7];
            vec3 L22  = environment.irradianceCoefficients[8];

            return (
                c1 * L22 * (n.x * n.x - n.y * n.y) +
                c3 * L20 * n.z * n.z +
                c4 * L00 -
                c5 * L20 +
                2.0 * c1 * (L2_2 * n.x * n.y + L21 * n.x * n.z + L2_1 * n.y * n.z) +
                2.0 * c2 * (L11 * n.x + L1_1 * n.y + L10 * n.z)
            ) / vec3(${M_PI});
            //divide by pi for lambertian https://seblagarde.wordpress.com/2012/01/08/pi-or-not-to-pi-in-game-lighting-equation/
        }
        
        LightInfo getLightInfo() {
            LightInfo lightInfo;

            lightInfo.specular     = vec3(0.0);
            lightInfo.diffuse      = vec3(0.0);
            lightInfo.clearcoat    = vec3(0.0);
            lightInfo.sheen        = vec3(0.0);
            lightInfo.transmission = vec3(0.0);
            lightInfo.irradiance   = getIrradiance(normalInfo.n);

            return lightInfo;
        }

        LightInfo lightInfo;

        float getRangeAttenuation(float range, float distance) {
            if (range <= 0.0) {
                return 1.0 / pow(distance, 2.0);
            }
            return max(min(1.0 - pow(distance / range, 4.0), 1.0), 0.0) / pow(distance, 2.0);
        }

        float getSpotAttenuation(vec3 pointToLight, vec3 spotDirection, float outerConeCos, float innerConeCos) {
            float actualCos = dot(normalize(spotDirection), normalize(-pointToLight));
            if (actualCos > outerConeCos) {
                if (actualCos < innerConeCos) {
                    return smoothstep(outerConeCos, innerConeCos, actualCos);
                }
                return 1.0;
            }
            return 0.0;
        }

        vec3 getLighIntensity(Light light, vec3 pointToLight) {
            float rangeAttenuation = 1.0;
            float spotAttenuation  = 1.0;

            if (light.lightType != ${LIGHT_TYPES.directional}) {
                rangeAttenuation = getRangeAttenuation(light.range, length(pointToLight));
            }
            if (light.lightType == ${LIGHT_TYPES.spot}) {
                spotAttenuation = getSpotAttenuation(pointToLight, light.direction, light.outerConeCos, light.innerConeCos);
            }
            return rangeAttenuation * spotAttenuation * light.intensity * light.color;
        }

        void applyOcclusion(vec2 coord) {
            float ao = materialInfo.occlusion;

            ${flags.useSSAO ? /* glsl */`
                ao = texture(ssaoTexture, coord.xy / vec2(frustum.width, frustum.height)).r;

                // for SSAO use min(ssao, materialInfo.occlusion) https://google.github.io/filament/Filament.md.html#toc5.6
                ${flags.hasTexture?.occlusionTexture ? /* glsl */`
                    ao = min(ao, materialInfo.occlusion);
                `: ''}
            `: ''}

            lightInfo.diffuse   = mix(lightInfo.diffuse   * ao, lightInfo.diffuse  , material.occlusionStrength);
            lightInfo.specular  = mix(lightInfo.specular  * ao, lightInfo.specular , material.occlusionStrength);
            lightInfo.sheen     = mix(lightInfo.sheen     * ao, lightInfo.sheen    , material.occlusionStrength);
            lightInfo.clearcoat = mix(lightInfo.clearcoat * ao, lightInfo.clearcoat, material.occlusionStrength);
            lightInfo.occlusion = ao;
        }

        vec3 getIBLRadianceGGX(vec3 n, vec3 v, float roughness, vec3 F0, float specularWeight) {
            float NdotV = clampedDot(n, v);
            float lod = roughness * float(environment.mipLevelCount - 1);
            vec3 reflection = normalize(reflect(-v, n));

            vec2 brdfSamplePoint = clamp(vec2(NdotV, roughness), vec2(0.0, 0.0), vec2(1.0, 1.0));
            vec2 f_ab = texture(envLUT, brdfSamplePoint).rg;
            vec4 specularSample = textureLod(envGGX, reflection, lod);

            vec3 specularLight = specularSample.rgb;

            // see https://bruop.github.io/ibl/#single_scattering_results at Single Scattering Results
            // Roughness dependent fresnel, from Fdez-Aguera
            vec3 Fr = max(vec3(1.0 - roughness), F0) - F0;
            vec3 k_S = F0 + Fr * pow(1.0 - NdotV, 5.0);

            ${flags.hasExtension.KHR_materials_iridescence ? /* glsl */`
            k_S = mix(k_S, materialInfo.iridescenceFresnel, materialInfo.iridescenceFactor);
            `: ''}
            
            vec3 FssEss = k_S * f_ab.x + f_ab.y;

            return specularWeight * specularLight * FssEss;
        }

        vec3 getIBLRadianceLambertian(vec3 n, vec3 v, float roughness, vec3 diffuseColor, vec3 F0, float specularWeight) {
            float NdotV = clampedDot(n, v);
            vec2 brdfSamplePoint = clamp(vec2(NdotV, roughness), vec2(0.0, 0.0), vec2(1.0, 1.0));
            vec2 f_ab = texture(envLUT, brdfSamplePoint).rg;

            vec3 irradiance = lightInfo.irradiance;

            ${flags.hasExtension.KHR_materials_iridescence ? /* glsl */`
            // Use the maximum component of the iridescence Fresnel color
            // Maximum is used instead of the RGB value to not get inverse colors for the diffuse BRDF
            vec3 iridescenceF0Max = vec3(max(max(materialInfo.iridescenceF0.r, materialInfo.iridescenceF0.g), materialInfo.iridescenceF0.b));

            // Blend between base F0 and iridescence F0
            vec3 _F0 = mix(F0, iridescenceF0Max, materialInfo.iridescenceFactor);
            `: /* wgsl */`
            vec3 _F0 = F0;
            `}

            // see https://bruop.github.io/ibl/#single_scattering_results at Single Scattering Results
            // Roughness dependent fresnel, from Fdez-Aguera

            vec3 Fr = max(vec3(1.0 - roughness), _F0) - _F0;
            vec3 k_S = _F0 + Fr * pow(1.0 - NdotV, 5.0);
            vec3 FssEss = specularWeight * k_S * f_ab.x + f_ab.y; // <--- GGX / specular light contribution (scale it down if the specularWeight is low)

            // Multiple scattering, from Fdez-Aguera
            float Ems = (1.0 - (f_ab.x + f_ab.y));
            vec3 F_avg = specularWeight * (_F0 + (1.0 - _F0) / 21.0);
            vec3 FmsEms = Ems * FssEss * F_avg / (1.0 - F_avg * Ems);
            vec3 k_D = diffuseColor * (1.0 - FssEss + FmsEms); // we use +FmsEms as indicated by the formula in the blog post (might be a typo in the implementation)

            return (FmsEms + k_D) * irradiance;
        }

        vec3 getIBLRadianceCharlie(vec3 n, vec3 v, float sheenRoughness, vec3 sheenColor) {
            float NdotV = clampedDot(n, v);
            float lod = sheenRoughness * float(environment.mipLevelCount - 1);
            vec3 reflection = normalize(reflect(-v, n));

            vec2 brdfSamplePoint = clamp(vec2(NdotV, sheenRoughness), vec2(0.0, 0.0), vec2(1.0, 1.0));
            float brdf = texture(envLUT, brdfSamplePoint).b;
            vec4 sheenSample = textureLod(envCharlie, reflection, lod);

            vec3 sheenLight = sheenSample.rgb;
            return sheenLight * sheenColor * brdf;
        }

        vec3 getPunctualRadianceClearCoat(vec3 clearcoatNormal, vec3 v, vec3 l, vec3 h, float VdotH, vec3 f0, vec3 f90, float clearcoatRoughness) {
            float NdotL = clampedDot(clearcoatNormal, l);
            float NdotV = clampedDot(clearcoatNormal, v);
            float NdotH = clampedDot(clearcoatNormal, h);
            return NdotL * BRDF_specularGGX(f0, f90, clearcoatRoughness * clearcoatRoughness, 1.0, VdotH, NdotL, NdotV, NdotH);
        }

        vec3 getPunctualRadianceSheen(vec3 sheenColor, float sheenRoughness, float NdotL, float NdotV, float NdotH) {
            return NdotL * BRDF_specularSheen(sheenColor, sheenRoughness, NdotL, NdotV, NdotH);
        }

        float applyIorToRoughness(float roughness, float ior) {
            // Scale roughness with IOR so that an IOR of 1.0 results in no microfacet refraction and
            // an IOR of 1.5 results in the default amount of microfacet refraction.
            return roughness * clamp(ior * 2.0 - 2.0, 0.0, 1.0);
        }

        vec3 getPunctualRadianceTransmission(vec3 normal, vec3 view, vec3 pointToLight, float alphaRoughness, vec3 f0, vec3 f90, vec3 baseColor, float ior) {
            float transmissionRoughness = applyIorToRoughness(alphaRoughness, ior);
        
            vec3 n = normalize(normal);           // Outward direction of surface point
            vec3 v = normalize(view);             // Direction from surface point to view
            vec3 l = normalize(pointToLight);
            vec3 l_mirror = normalize(l + 2.0*n*dot(-l, n));     // Mirror light reflection vector on surface
            vec3 h = normalize(l_mirror + v);            // Halfway vector between transmission light vector and v
        
            float D   = D_GGX(clamp(dot(n, h), 0.0, 1.0), transmissionRoughness);
            vec3  F   = F_Schlick_3(f0, f90, clamp(dot(v, h), 0.0, 1.0));
            float Vis = V_GGX(clamp(dot(n, l_mirror), 0.0, 1.0), clamp(dot(n, v), 0.0, 1.0), transmissionRoughness);
        
            // Transmission BTDF
            return (1.0 - F) * baseColor.rgb * D * Vis;
        }

        // Compute attenuated light as it travels through a volume.
        vec3 applyVolumeAttenuation(vec3 radiance, float transmissionDistance, vec3 attenuationColor, float attenuationDistance) {
            // Compute light attenuation using Beer's law.
            vec3 attenuationCoefficient = -log(attenuationColor) / attenuationDistance;
            vec3 transmittance = exp(-attenuationCoefficient * transmissionDistance); // Beer's law
            return attenuationDistance == 0.0 ? radiance : transmittance * radiance; // Attenuation distance is +∞ (which we indicate by zero), i.e. the transmitted color is not attenuated at all.
        }


        vec3 getVolumeTransmissionRay(vec3 n, vec3 v, float thickness, float ior, vec3 modelScale) {
            // Direction of refracted light.
            vec3 refractionVector = refract(-v, normalize(n), 1.0 / ior);

            // The thickness is specified in local space.
            return normalize(refractionVector) * thickness * modelScale;
        }

        vec3 getTransmissionSample(vec2 fragCoord, float roughness, float ior) {
            ${flags.useTransmission ? /* glsl */`
            float framebufferLod  = log2(float(textureSize(transmissionTexture, 0).x)) * applyIorToRoughness(roughness, ior);
            vec3 transmittedLight = textureLod(transmissionTexture, fragCoord.xy, framebufferLod).rgb;
            return transmittedLight;
            `: /* glsl */`
            return vec3(0.0);
            `}
        }

        vec3 getIBLVolumeRefraction(vec3 n, vec3 v, float perceptualRoughness, vec3 baseColor, vec3 f0, vec3 f90, vec3 position, vec3 modelScale, mat4 viewMatrix, mat4 projMatrix, float ior, float thickness, vec3 attenuationColor, float attenuationDistance) {
            vec3 transmissionRay = getVolumeTransmissionRay(n, v, thickness, ior, modelScale);
            vec3 refractedRayExit = position + transmissionRay;

            // Project refracted vector on the framebuffer, while mapping to normalized device coordinates.
            vec4 ndcPos = projMatrix * viewMatrix * vec4(refractedRayExit, 1.0);
            vec2 refractionCoords = vec2(ndcPos.x, ndcPos.y) / ndcPos.w;
            refractionCoords = refractionCoords + 1.0;
            refractionCoords = refractionCoords / 2.0;

            // Sample framebuffer to get pixel the refracted ray hits.
            vec3 transmittedLight = getTransmissionSample(refractionCoords, perceptualRoughness, ior);

            vec3 attenuatedColor = applyVolumeAttenuation(transmittedLight, length(transmissionRay), attenuationColor, attenuationDistance);

            // Sample GGX LUT to get the specular component.
            float NdotV = clampedDot(n, v);
            vec2 brdfSamplePoint = clamp(vec2(NdotV, perceptualRoughness), vec2(0.0, 0.0), vec2(1.0, 1.0));
            vec2 brdf = texture(envLUT, brdfSamplePoint).rg;
            vec3 specularColor = f0 * brdf.x + f90 * brdf.y;

            return (1.0 - specularColor) * attenuatedColor * baseColor.rgb;
        }

        float getLinearDepth(float d) {
            return frustum.near * frustum.far / (frustum.far + d * (frustum.near - frustum.far));
        }

        vec2 getShadowCascade() {
            int layer   = 0;
            float blend = 0.0;
            float depth = getLinearDepth(gl_FragCoord.z);
            for(int i = 0; i < lighting.shadowCascadeCount; i++) {
                float z = lighting.shadowCascadeDepths[i];
                layer = i;
                if(depth < z) {
                    blend = smoothstep(0.95, 1.0, depth / z);
                    break;
                }
            }
            return vec2(float(layer), blend);
        }

        ${flags.useShadows ? /* glsl */`
            // ------------ported from filament ------------------------------------------------
            // @see https://github.com/google/filament/blob/a0af0a98cb471cdb67dcd67951e3d34e7f44ac54/shaders/src/shadowing.fs
            
            float sampleDepth(int layer, vec2 uv, float depth) {
                // depth must be clamped to support floating-point depth formats. This is to avoid comparing a
                // value from the depth texture (which is never greater than 1.0) with a greater-than-one
                // comparison value (which is possible with floating-point formats).
                return texture(shadowsTexture, vec4(uv, layer, saturate(depth)));
            }

            float shadowPCF(int layer, float bias) {
                vec4 shadowPosition = v_ShadowTexcoords[layer];
                shadowPosition.z = shadowPosition.z - bias;

                vec3 position = shadowPosition.xyz * (1.0 / shadowPosition.w);
                // note: shadowPosition.z is in the [1, 0] range (reversed Z)
                vec2 size = vec2(textureSize(shadowsTexture, 0));
                vec2 texelSize = vec2(1.0) / size;
            
                //  Castaño, 2013, "Shadow Mapping Summary Part 1"
                float depth = position.z;
            
                // clamp position to avoid overflows below, which cause some GPUs to abort
                position = vec3(clamp(position.xy, vec2(-1.0), vec2(2.0)), position.z);
            
                vec2 offset = vec2(0.5);
                vec2 uv = (position.xy * size) + offset;
                vec2 base = (floor(uv) - offset) * texelSize;
                vec2 st = fract(uv);
            
                vec2 uw = vec2(3.0 - 2.0 * st.x, 1.0 + 2.0 * st.x);
                vec2 vw = vec2(3.0 - 2.0 * st.y, 1.0 + 2.0 * st.y);
            
                vec2 u = vec2((2.0 - st.x) / uw.x - 1.0, st.x / uw.y + 1.0);
                vec2 v = vec2((2.0 - st.y) / vw.x - 1.0, st.y / vw.y + 1.0);
            
                u = u * texelSize.x;
                v = v * texelSize.y;
            
                float sum = 0.0;
                sum = sum + (uw.x * vw.x * sampleDepth(layer, base + vec2(u.x, v.x), depth));
                sum = sum + (uw.y * vw.x * sampleDepth(layer, base + vec2(u.y, v.x), depth));
                sum = sum + (uw.x * vw.y * sampleDepth(layer, base + vec2(u.x, v.y), depth));
                sum = sum + (uw.y * vw.y * sampleDepth(layer, base + vec2(u.y, v.y), depth));
                return sum * (1.0 / 16.0);
            }
            //---------------------------------------------------------------------------------

            float getShadowFactor(Light light, float NdotL) {
                if(light.lightType == ${LIGHT_TYPES.point}) {
                    return 1.0;
                }

                int   layer = light.shadowLayer;
                float blend = 0.0;
                float bias  = clamp(0.0005 * tan(acos(NdotL)), 0.0, 0.001); //apply slight additional bias to reduce artifacts

                if(light.lightType == ${LIGHT_TYPES.directional}) {
                    vec2 shadowCascade = getShadowCascade();
                    layer = layer + int(shadowCascade.x);
                    blend = shadowCascade.y;
                }
                
                if(blend > 0.0) {
                    float nearShadow = shadowPCF(layer, bias);
                    float farShadow  = shadowPCF(layer + 1, bias);
                    return mix(nearShadow, farShadow, blend);
                } else {
                    return shadowPCF(layer, bias);
                }
            }
        `: /* glsl */`
            float getShadowFactor(Light light, float NdotL){
                return 1.0;
            }
        `}

        void applyPunctualLights() {
            vec3 v = normalInfo.v;
            vec3 n = normalInfo.n;

            float NdotV = clampedDot(n, v);
            
            for (int i = 0; i < lighting.lightCount; i = i + 1) {

                Light light = lighting.lights[i];

                vec3 pointToLight;
                if (light.lightType != ${LIGHT_TYPES.directional}) {
                    pointToLight = light.position - v_position;
                } else {
                    pointToLight = -light.direction;
                }

                vec3 l = normalize(pointToLight);   // Direction from surface point to light
                vec3 h = normalize(l + v);          // Direction of the vector between l and v, called halfway vector
                float NdotL = clampedDot(n, l);
                float NdotH = clampedDot(n, h);
                float LdotH = clampedDot(l, h);
                float VdotH = clampedDot(v, h);
                if (NdotL > 0.0 || NdotV > 0.0) {
                    float shadow   = getShadowFactor(light, NdotL);
                    vec3 intensity = getLighIntensity(light, pointToLight) * shadow;

                    ${flags.hasExtension.KHR_materials_iridescence ? /* glsl */`
                    lightInfo.diffuse  = lightInfo.diffuse  + intensity * NdotL * BRDF_lambertianIridescence(materialInfo.f0, materialInfo.f90, materialInfo.c_diff, materialInfo.specularWeight, VdotH, materialInfo.iridescenceFresnel, materialInfo.iridescenceFactor);
                    lightInfo.specular = lightInfo.specular + intensity * NdotL * BRDF_specularGGXIridescence(materialInfo.f0, materialInfo.f90, materialInfo.alphaRoughness, materialInfo.specularWeight, VdotH, NdotL, NdotV, NdotH, materialInfo.iridescenceFresnel, materialInfo.iridescenceFactor);
                    `: /* glsl */`
                    lightInfo.diffuse  = lightInfo.diffuse  + intensity * NdotL * BRDF_lambertian(materialInfo.f0, materialInfo.f90, materialInfo.c_diff, materialInfo.specularWeight, VdotH);
                    lightInfo.specular = lightInfo.specular + intensity * NdotL * BRDF_specularGGX(materialInfo.f0, materialInfo.f90, materialInfo.alphaRoughness, materialInfo.specularWeight, VdotH, NdotL, NdotV, NdotH);
                    `}
                    
                    ${flags.hasExtension?.KHR_materials_sheen ? /* glsl */`
                        lightInfo.sheen = lightInfo.sheen + intensity * getPunctualRadianceSheen(materialInfo.sheenColorFactor, materialInfo.sheenRoughnessFactor, NdotL, NdotV, NdotH);
                        // lightInfo.sheenScaling = min(1.0 - max3(materialInfo.sheenColorFactor) * albedoSheenScalingLUT(NdotV, materialInfo.sheenRoughnessFactor), 1.0 - max3(materialInfo.sheenColorFactor) * albedoSheenScalingLUT(NdotL, materialInfo.sheenRoughnessFactor));
                    `: ''}

                    ${flags.hasExtension?.KHR_materials_clearcoat ? /* glsl */`
                        lightInfo.clearcoat = lightInfo.clearcoat + intensity * getPunctualRadianceClearCoat(materialInfo.clearcoatNormal, v, l, h, VdotH, materialInfo.clearcoatF0, materialInfo.clearcoatF90, materialInfo.clearcoatRoughness);
                    `: ''}
                }

                ${flags.hasExtension?.KHR_materials_transmission ? /* glsl */`
                    // If the light ray travels through the geometry, use the point it exits the geometry again.
                    // That will change the angle to the light source, if the material refracts the light ray.
                    vec3 transmissionRay = getVolumeTransmissionRay(n, v, materialInfo.thickness, materialInfo.ior, v_modelScale);
                    pointToLight = pointToLight - transmissionRay;
                    l = normalize(pointToLight);

                    vec3 intensity = getLighIntensity(light, pointToLight);
                    vec3 transmittedLight = intensity * getPunctualRadianceTransmission(n, v, l, materialInfo.alphaRoughness, materialInfo.f0, materialInfo.f90, materialInfo.c_diff, materialInfo.ior);

                    ${flags.hasExtension?.KHR_materials_volume ? /* glsl */`
                    transmittedLight = applyVolumeAttenuation(transmittedLight, length(transmissionRay), materialInfo.attenuationColor, materialInfo.attenuationDistance);
                    `: ''}

                    lightInfo.transmission = lightInfo.transmission + transmittedLight;
                `: ''}
            }
        }

        void applyEnvironment() {
            vec3 n = normalInfo.n;
            vec3 v = normalInfo.v;

            lightInfo.specular = lightInfo.specular + getIBLRadianceGGX(n, v, materialInfo.perceptualRoughness, materialInfo.f0, materialInfo.specularWeight);
            lightInfo.diffuse  = lightInfo.diffuse + getIBLRadianceLambertian(n, v, materialInfo.perceptualRoughness, materialInfo.c_diff, materialInfo.f0, materialInfo.specularWeight);
            
            ${flags.hasExtension?.KHR_materials_sheen ? /* glsl */`
                lightInfo.sheen = lightInfo.sheen + getIBLRadianceCharlie(n, v, materialInfo.sheenRoughnessFactor, materialInfo.sheenColorFactor);
            `: ''}

            ${flags.hasExtension?.KHR_materials_clearcoat ? /* glsl */`
                lightInfo.clearcoat = lightInfo.clearcoat + getIBLRadianceGGX(materialInfo.clearcoatNormal, v, materialInfo.clearcoatRoughness, materialInfo.clearcoatF0, 1.0);
            `: ''}

            
        }

        void applyTransmission() {
            vec3 n = normalInfo.n;
            vec3 v = normalInfo.v;
            ${flags.hasExtension?.KHR_materials_transmission ? /* glsl */`
                lightInfo.transmission = lightInfo.transmission + getIBLVolumeRefraction(
                    n, v,
                    materialInfo.perceptualRoughness,
                    materialInfo.c_diff, materialInfo.f0, materialInfo.f90,
                    v_position, v_modelScale, frustum.viewMatrix, frustum.projectionMatrix,
                    materialInfo.ior, materialInfo.thickness, materialInfo.attenuationColor, materialInfo.attenuationDistance);
            `: ''}
        }

        vec4 applyLighting() {
            vec3 color = vec3(0.0);

            float albedoSheenScaling = 1.0;

            ${flags.hasExtension?.KHR_materials_transmission ? /* glsl */`
            vec3 diffuse = mix(lightInfo.diffuse, lightInfo.transmission, materialInfo.transmissionFactor);
            `: /* glsl */`
            vec3 diffuse = lightInfo.diffuse;
            `}

            color = materialInfo.emissive + diffuse + lightInfo.specular;
            color = lightInfo.sheen + color * albedoSheenScaling;
            color = color * (1.0 - materialInfo.clearcoatFactor * materialInfo.clearcoatFresnel) + (lightInfo.clearcoat * materialInfo.clearcoatFactor);

            return vec4(color, materialInfo.baseColor.a);            
        }

        vec3 applyToneMap(vec3 color) {
            vec3 c = color * environment.exposure;

            ${flags.tonemap === 'Aces Narkowicz' ? /* glsl */`
                c = toneMapACES_Narkowicz(c);
            `: ''}

            ${flags.tonemap === 'Aces Hill' ? /* glsl */`
                c = toneMapACES_Hill(c);
            `: ''}

            ${flags.tonemap === 'Aces Hill Exposure Boost' ? /* glsl */`
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
