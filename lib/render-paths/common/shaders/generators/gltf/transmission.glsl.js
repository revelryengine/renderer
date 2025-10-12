/**
 * @param {import('../../shader.js').ShaderInitialized<import('../../gltf-shader.js').GLTFShader>} shader
 */
export function generate({ flags, locations }) {
    const { bindGroup } = locations;

    const code = /* glsl */`
        #pragma revTextureBinding(transmissionTexture, 2, ${bindGroup.transmissionTexture}, ${bindGroup.transmissionSampler})
        uniform sampler2D transmissionTexture;

        float applyIorToRoughness(float roughness, float ior) {
            // Scale roughness with IOR so that an IOR of 1.0 results in no microfacet refraction and
            // an IOR of 1.5 results in the default amount of microfacet refraction.
            return roughness * clamp(ior * 2.0 - 2.0, 0.0, 1.0);
        }

        vec3 getVolumeTransmissionRay(vec3 n, vec3 v, float thickness, float ior, vec3 modelScale) {
            // Direction of refracted light.
            vec3 refractionVector = refract(-v, normalize(n), 1.0 / ior);

            // The thickness is specified in local space.
            return normalize(refractionVector) * thickness * modelScale;
        }

        // Compute attenuated light as it travels through a volume.
        vec3 applyVolumeAttenuation(vec3 radiance, float transmissionDistance, vec3 attenuationColor, float attenuationDistance) {
             if (attenuationDistance == 0.0){
                // Attenuation distance is +∞ (which we indicate by zero), i.e. the transmitted color is not attenuated at all.
                return radiance;
            }

            // Compute light attenuation using Beer's law.
            vec3 transmittance = pow(attenuationColor, vec3(transmissionDistance / attenuationDistance));
            return transmittance * radiance;
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
            ${flags.useEnvironment ? /* glsl */`
            float NdotV = clampedDot(n, v);
            vec2 brdfSamplePoint = clamp(vec2(NdotV, perceptualRoughness), vec2(0.0, 0.0), vec2(1.0, 1.0));
            vec2 brdf = texture(envLUT, brdfSamplePoint).rg;
            vec3 specularColor = f0 * brdf.x + f90 * brdf.y;
            `: /* glsl */`
            vec3 specularColor = vec3(0.0);
            `}

            return (1.0 - specularColor) * attenuatedColor * baseColor.rgb;
        }

        void applyTransmission() {
            vec3 n = normalInfo.n;
            vec3 v = normalInfo.v;

            lightInfo.transmission = lightInfo.transmission + getIBLVolumeRefraction(
                n, v,
                materialInfo.perceptualRoughness,
                materialInfo.c_diff, materialInfo.f0, materialInfo.f90,
                v_position, normalInfo.scale, frustum.viewMatrix, frustum.projectionMatrix,
                materialInfo.ior, materialInfo.thickness, materialInfo.attenuationColor, materialInfo.attenuationDistance);

            lightInfo.diffuse = mix(lightInfo.diffuse, lightInfo.transmission, materialInfo.transmissionFactor);
        }
    `

    return code;
}

export default generate;
