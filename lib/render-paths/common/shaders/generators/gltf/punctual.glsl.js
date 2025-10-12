import { LIGHT_TYPES } from '../../../../../constants.js';

/**
 * @param {import('../../shader.js').ShaderInitialized<import('../../gltf-shader.js').GLTFShader>} shader
 */
export function generate({ flags, locations, input: { renderNode: { punctual } } }) {
    const { bindGroup } = locations;

    const code = /* glsl */`
        ${punctual.generateUniformBlock(2, bindGroup.punctual)}

        ${flags.useShadows ? /* glsl */`
        precision highp sampler2DArrayShadow;
        #pragma revTextureBinding(shadowsTexture, 2, ${bindGroup.shadowsTexture}, ${bindGroup.shadowsSampler})
        uniform sampler2DArrayShadow shadowsTexture;
        `: ''}

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
                    float angularAttenuation = (actualCos - outerConeCos) / (innerConeCos - outerConeCos);
                    return angularAttenuation * angularAttenuation;
                }
                return 1.0;
            }
            return 0.0;
        }

        vec3 getLightIntensity(Light light, vec3 pointToLight) {
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

        vec3 getPunctualRadianceClearCoat(vec3 clearcoatNormal, vec3 v, vec3 l, vec3 h, float VdotH, vec3 f0, vec3 f90, float clearcoatRoughness) {
            float NdotL = clampedDot(clearcoatNormal, l);
            float NdotV = clampedDot(clearcoatNormal, v);
            float NdotH = clampedDot(clearcoatNormal, h);
            return NdotL * BRDF_specularGGX(f0, f90, clearcoatRoughness * clearcoatRoughness, 1.0, VdotH, NdotL, NdotV, NdotH);
        }

        vec3 getPunctualRadianceSheen(vec3 sheenColor, float sheenRoughness, float NdotL, float NdotV, float NdotH) {
            return NdotL * BRDF_specularSheen(sheenColor, sheenRoughness, NdotL, NdotV, NdotH);
        }

        ${flags.useShadows ? /* glsl */`
            vec2 getShadowCascade() {
                int layer   = 0;
                float blend = 0.0;
                float depth = getLinearDepth(gl_FragCoord.z);
                for(int i = 0; i < punctual.shadowCascadeCount; i++) {
                    float z = punctual.shadowCascadeDepths[i];
                    layer = i;
                    if(depth < z) {
                        blend = smoothstep(0.95, 1.0, depth / z);
                        break;
                    }
                }
                return vec2(float(layer), blend);
            }

            // ------------ported from filament ------------------------------------------------
            // @see https://github.com/google/filament/blob/a0af0a98cb471cdb67dcd67951e3d34e7f44ac54/shaders/src/shadowing.fs

            float sampleDepth(int layer, vec2 uv, float depth) {
                // depth must be clamped to support floating-point depth formats. This is to avoid comparing a
                // value from the depth texture (which is never greater than 1.0) with a greater-than-one
                // comparison value (which is possible with floating-point formats).
                return texture(shadowsTexture, vec4(uv, layer, saturate(depth)));
            }

            float shadowPCF(int layer, float bias) {
                vec4 shadowPosition = v_shadowTexcoords[layer];
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
                vec2 uv     = (position.xy * size) + offset;
                vec2 base   = (floor(uv) - offset) * texelSize;
                vec2 st     = fract(uv);

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
            vec2 getShadowCascade() {
                return vec2(0.0, 0.0);
            }
            float getShadowFactor(Light light, float NdotL){
                return 1.0;
            }
        `}

        void applyPunctualLight(Light light, vec3 v, vec3 n, float NdotV) {
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
                vec3 intensity = getLightIntensity(light, pointToLight) * shadow;

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

            ${flags.useTransmission ? /* glsl */`
                // If the light ray travels through the geometry, use the point it exits the geometry again.
                // That will change the angle to the light source, if the material refracts the light ray.
                vec3 transmissionRay = getVolumeTransmissionRay(n, v, materialInfo.thickness, materialInfo.ior, normalInfo.scale);
                pointToLight = pointToLight - transmissionRay;
                l = normalize(pointToLight);

                vec3 intensity = getLightIntensity(light, pointToLight);
                vec3 transmittedLight = intensity * getPunctualRadianceTransmission(n, v, l, materialInfo.alphaRoughness, materialInfo.f0, materialInfo.f90, materialInfo.c_diff, materialInfo.ior);

                ${flags.hasExtension?.KHR_materials_volume ? /* glsl */`
                transmittedLight = applyVolumeAttenuation(transmittedLight, length(transmissionRay), materialInfo.attenuationColor, materialInfo.attenuationDistance);
                `: ''}

                lightInfo.transmission = lightInfo.transmission + transmittedLight;
            `: ''}
        }

        void applyPunctual() {
            vec3 v = normalInfo.v;
            vec3 n = normalInfo.n;

            float NdotV = clampedDot(n, v);

            int count = min(punctual.lightCount, ${punctual.maxLights});
            for(int i = 0; i < count; i++) {
                applyPunctualLight(punctual.lights[i], v, n, NdotV);
            }
        }
    `

    return code;
}

export default generate;
