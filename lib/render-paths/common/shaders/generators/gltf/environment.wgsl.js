import { Environment } from '../../../../../environment.js';

const environmentUniformBlock = Environment.generateUniformBlock('wgsl', 2, '$$binding');

/**
 * @param {import('../../shader.js').ShaderInitialized<import('../../gltf-shader.js').GLTFShader>} shader
 */
export function generate({ flags, locations }) {
    const M_PI = '3.141592653589793';

    const { bindGroup } = locations;

    const code = /* wgsl */`
        ${environmentUniformBlock.replace('$$binding', String(bindGroup.environment))}

        @group(2) @binding(${bindGroup.envSampler}) var envSampler: sampler;
        @group(2) @binding(${bindGroup.envLUT})     var envLUT: texture_2d<f32>;
        @group(2) @binding(${bindGroup.envGGX})     var envGGX: texture_cube<f32>;
        @group(2) @binding(${bindGroup.envCharlie}) var envCharlie: texture_cube<f32>;

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

        fn getIBLReflection(n: vec3<f32>, v: vec3<f32>) -> vec3<f32> {
            var reflection = normalize(reflect(-v, n));

            if(bool(environment.localized)) {
                // Apply local correction
                // @see https://developer.arm.com/documentation/102179/0100/Implement-reflections-with-a-local-cubemap
                var intersectMaxPointPlanes = (environment.boundingBoxMax - in.position) / reflection;
                var intersectMinPointPlanes = (environment.boundingBoxMin - in.position) / reflection;
                // Looking only for intersections in the forward direction of the ray.
                var largestParams = max(intersectMaxPointPlanes, intersectMinPointPlanes);
                // Smallest value of the ray parameters gives us the intersection.
                var distToIntersect = min(min(largestParams.x, largestParams.y), largestParams.z);
                // Find the position of the intersection point.
                var intersectPositionWS = reflection * distToIntersect + in.position;
                // Get local corrected reflection vector.
                reflection = intersectPositionWS;// - _EnviCubeMapPos;
            }

            return reflection;
        }

        fn getIBLRadianceGGX(n: vec3<f32>, v: vec3<f32>, roughness: f32, F0: vec3<f32>, specularWeight: f32) -> vec3<f32>{
            var NdotV = clampedDot(n, v);
            var lod = roughness * f32(environment.mipLevelCount - 1);

            var reflection = getIBLReflection(n, v);

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

            var reflection = getIBLReflection(n, v);

            var brdfSamplePoint = clamp(vec2<f32>(NdotV, sheenRoughness), vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0));
            var brdf = textureSample(envLUT, envSampler, brdfSamplePoint).b;
            var sheenSample = textureSampleLevel(envCharlie, envSampler, reflection, lod);

            var sheenLight = sheenSample.rgb;
            return sheenLight * sheenColor * brdf;
        }

        fn applyEnvironment() {
            var n = normalInfo.n;
            var v = normalInfo.v;

            lightInfo.irradiance = getIrradiance(n);
            lightInfo.specular   = lightInfo.specular + getIBLRadianceGGX(n, v, materialInfo.perceptualRoughness, materialInfo.f0, materialInfo.specularWeight);
            lightInfo.diffuse    = lightInfo.diffuse + getIBLRadianceLambertian(n, v, materialInfo.perceptualRoughness, materialInfo.c_diff, materialInfo.f0, materialInfo.specularWeight);

            ${flags.hasExtension?.KHR_materials_sheen ? /* wgsl */`
                lightInfo.sheen = lightInfo.sheen + getIBLRadianceCharlie(n, v, materialInfo.sheenRoughnessFactor, materialInfo.sheenColorFactor);
            `: ''}

            ${flags.hasExtension?.KHR_materials_clearcoat ? /* wgsl */`
                lightInfo.clearcoat = lightInfo.clearcoat + getIBLRadianceGGX(materialInfo.clearcoatNormal, v, materialInfo.clearcoatRoughness, materialInfo.clearcoatF0, 1.0);
            `: ''}
        }
    `

    return code;
}

export default generate;
