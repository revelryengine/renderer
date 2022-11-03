import { LIGHT_TYPES } from '../../../constants.js';
import { Punctual    } from '../../../punctual.js';

import generateUniformBlock from '../uniform.wgsl.js';

const punctualUniformBlock = generateUniformBlock(Punctual, 2, '$$binding');

export function generate({ flags, locations }) {
    const { bindGroup } = locations;

    const code = /* wgsl */`
        ${punctualUniformBlock.replace('$$binding', bindGroup.punctual)}
        
        ${flags.useShadows ? /* wgsl */`
        @group(2) @binding(${bindGroup.shadowsTexture}) var shadowsTexture: texture_depth_2d_array;
        @group(2) @binding(${bindGroup.shadowsSampler}) var shadowsSampler: sampler_comparison;
        `: ''}

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

        fn getPunctualRadianceClearCoat(clearcoatNormal: vec3<f32>, v: vec3<f32>, l: vec3<f32>, h: vec3<f32>, VdotH: f32, f0: vec3<f32>, f90: vec3<f32>, clearcoatRoughness: f32) -> vec3<f32> {
            var NdotL = clampedDot(clearcoatNormal, l);
            var NdotV = clampedDot(clearcoatNormal, v);
            var NdotH = clampedDot(clearcoatNormal, h);
            return NdotL * BRDF_specularGGX(f0, f90, clearcoatRoughness * clearcoatRoughness, 1.0, VdotH, NdotL, NdotV, NdotH);
        }

        fn getPunctualRadianceSheen(sheenColor: vec3<f32>, sheenRoughness: f32, NdotL: f32, NdotV: f32, NdotH: f32) -> vec3<f32> {
            return NdotL * BRDF_specularSheen(sheenColor, sheenRoughness, NdotL, NdotV, NdotH);
        }

        ${flags.useShadows ? /* wgsl */`
            fn getShadowCascade() -> vec2<f32> {
                var layer = 0;
                var blend = 0.0;
                var depth = getLinearDepth(in.gl_FragCoord.z * 0.5 + 0.5);
                for(var i = 0; i < punctual.shadowCascadeCount; i++) {
                    var z = punctual.shadowCascadeDepths[i];
                    layer = i;
                    if(depth < z) {
                        blend = smoothstep(0.95, 1.0, depth / z);  
                        break;
                    }
                }
                return vec2<f32>(f32(layer), blend);
            }

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
            fn getShadowCascade() -> vec2<f32> {
                return vec2<f32>(0.0, 0.0);
            }
            
            fn getShadowFactor(light: Light, NdotL: f32) -> f32{
                return 1.0;
            }
        `}

        fn applyPunctual(){
            var v = normalInfo.v;
            var n = normalInfo.n;

            var NdotV = clampedDot(n, v);
            
            for (var i = 0; i < punctual.lightCount; i = i + 1) {

                var light = punctual.lights[i];

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

                ${flags.useTransmission ? /* wgsl */`
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
    `

    return code;
}

export default generate;