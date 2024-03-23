/**
 * @param {import('../../shader.js').ShaderInitialized<import('../../gltf-shader.js').GLTFShader>} shader
 */
export function generate({ flags, locations }) {
    const { bindGroup } = locations;

    const code = /* wgsl */`
        @group(2) @binding(${bindGroup.transmissionSampler}) var transmissionSampler: sampler;
        @group(2) @binding(${bindGroup.transmissionTexture}) var transmissionTexture: texture_2d<f32>;

        fn applyIorToRoughness(roughness: f32, ior: f32) -> f32 {
            // Scale roughness with IOR so that an IOR of 1.0 results in no microfacet refraction and
            // an IOR of 1.5 results in the default amount of microfacet refraction.
            return roughness * clamp(ior * 2.0 - 2.0, 0.0, 1.0);
        }

        fn getVolumeTransmissionRay(n: vec3<f32>, v: vec3<f32>, thickness: f32, ior: f32, modelScale: vec3<f32>) -> vec3<f32>{
            // Direction of refracted light.
            var refractionVector = refract(-v, normalize(n), 1.0 / ior);

            // The thickness is specified in local space.
            return normalize(refractionVector) * thickness * modelScale;
        }

        // Compute attenuated light as it travels through a volume.
        fn applyVolumeAttenuation(radiance: vec3<f32>, transmissionDistance: f32, attenuationColor: vec3<f32>, attenuationDistance: f32) -> vec3<f32>{
            // Compute light attenuation using Beer's law.
            var attenuationCoefficient = -log(attenuationColor) / attenuationDistance;
            var transmittance = exp(-attenuationCoefficient * transmissionDistance); // Beer's law
            return select(transmittance * radiance, radiance, attenuationDistance == 0.0); // Attenuation distance is +∞ (which we indicate by zero), i.e. the transmitted color is not attenuated at all.
        }

        fn getTransmissionSample(fragCoord: vec2<f32>, roughness: f32, ior: f32) -> vec3<f32> {
            ${flags.useTransmission ? /* wgsl */`
            var framebufferLod  = log2(f32(textureDimensions(transmissionTexture, 0).x)) * applyIorToRoughness(roughness, ior);
            var transmittedLight = textureSampleLevel(transmissionTexture, transmissionSampler, fragCoord.xy, framebufferLod).rgb;
            return transmittedLight;
            `: /* wgsl */`
            return vec3<f32>(0.0);
            `}
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

            ${flags.useEnvironment ? /* wgsl */`
            // Sample GGX LUT to get the specular component.
            var NdotV = clampedDot(n, v);
            var brdfSamplePoint = clamp(vec2<f32>(NdotV, perceptualRoughness), vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0));
            var brdf = textureSample(envLUT, envSampler, brdfSamplePoint).rg;
            var specularColor = f0 * brdf.x + f90 * brdf.y;
            `: /* wgsl */`
            var specularColor = vec3<f32>(0.0);
            `}

            return (1.0 - specularColor) * attenuatedColor * baseColor.rgb;
        }

        fn applyTransmission() {
            var n = normalInfo.n;
            var v = normalInfo.v;

            lightInfo.transmission = lightInfo.transmission + getIBLVolumeRefraction(
                n, v,
                materialInfo.perceptualRoughness,
                materialInfo.c_diff, materialInfo.f0, materialInfo.f90,
                in.position, normalInfo.scale, frustum.viewMatrix, frustum.projectionMatrix,
                materialInfo.ior, materialInfo.thickness, materialInfo.attenuationColor, materialInfo.attenuationDistance);

            lightInfo.diffuse = mix(lightInfo.diffuse, lightInfo.transmission, materialInfo.transmissionFactor);
        }
    `

    return code;
}

export default generate;
