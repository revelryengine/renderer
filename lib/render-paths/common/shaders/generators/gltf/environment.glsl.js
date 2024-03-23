
import { Environment } from '../../../../../environment.js';

const environmentUniformBlock = Environment.generateUniformBlock('glsl', 2, '$$binding');

/**
 * @param {import('../../shader.js').ShaderInitialized<import('../../gltf-shader.js').GLTFShader>} shader
 */
export function generate({ flags, locations }) {
    const M_PI = '3.141592653589793';

    const { bindGroup } = locations;

    const code = /* glsl */`
        ${environmentUniformBlock.replace('$$binding', String(bindGroup.environment))}

        #pragma revTextureBinding(envLUT, 2, ${bindGroup.envLUT}, ${bindGroup.envSampler})
        uniform sampler2D envLUT;

        #pragma revTextureBinding(envGGX, 2, ${bindGroup.envGGX}, ${bindGroup.envSampler})
        uniform samplerCube envGGX;

        #pragma revTextureBinding(envCharlie, 2, ${bindGroup.envCharlie}, ${bindGroup.envSampler})
        uniform samplerCube envCharlie;

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

        vec3 getIBLReflection(vec3 n, vec3 v) {
            vec3 reflection = normalize(reflect(-v, n));

            if(bool(environment.localized)) {
                // Apply local correction
                // @see https://developer.arm.com/documentation/102179/0100/Implement-reflections-with-a-local-cubemap
                vec3 intersectMaxPointPlanes = (environment.boundingBoxMax - v_position) / reflection;
                vec3 intersectMinPointPlanes = (environment.boundingBoxMin - v_position) / reflection;
                // Looking only for intersections in the forward direction of the ray.
                vec3 largestParams = max(intersectMaxPointPlanes, intersectMinPointPlanes);
                // Smallest value of the ray parameters gives us the intersection.
                float distToIntersect = min(min(largestParams.x, largestParams.y), largestParams.z);
                // Find the position of the intersection point.
                vec3 intersectPositionWS = reflection * distToIntersect + v_position;
                // Get local corrected reflection vector.
                reflection = intersectPositionWS;// - _EnviCubeMapPos;
            }

            return reflection;
        }

        vec3 getIBLRadianceGGX(vec3 n, vec3 v, float roughness, vec3 F0, float specularWeight) {
            float NdotV = clampedDot(n, v);
            float lod = roughness * float(environment.mipLevelCount - 1);

            vec3 reflection = getIBLReflection(n, v);

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

            vec3 reflection = getIBLReflection(n, v);

            vec2 brdfSamplePoint = clamp(vec2(NdotV, sheenRoughness), vec2(0.0, 0.0), vec2(1.0, 1.0));
            float brdf = texture(envLUT, brdfSamplePoint).b;
            vec4 sheenSample = textureLod(envCharlie, reflection, lod);

            vec3 sheenLight = sheenSample.rgb;
            return sheenLight * sheenColor * brdf;
        }

        void applyEnvironment() {
            vec3 n = normalInfo.n;
            vec3 v = normalInfo.v;

            lightInfo.irradiance = getIrradiance(n);
            lightInfo.specular   = lightInfo.specular + getIBLRadianceGGX(n, v, materialInfo.perceptualRoughness, materialInfo.f0, materialInfo.specularWeight);
            lightInfo.diffuse    = lightInfo.diffuse + getIBLRadianceLambertian(n, v, materialInfo.perceptualRoughness, materialInfo.c_diff, materialInfo.f0, materialInfo.specularWeight);

            ${flags.hasExtension?.KHR_materials_sheen ? /* glsl */`
                lightInfo.sheen = lightInfo.sheen + getIBLRadianceCharlie(n, v, materialInfo.sheenRoughnessFactor, materialInfo.sheenColorFactor);
            `: ''}

            ${flags.hasExtension?.KHR_materials_clearcoat ? /* glsl */`
                lightInfo.clearcoat = lightInfo.clearcoat + getIBLRadianceGGX(materialInfo.clearcoatNormal, v, materialInfo.clearcoatRoughness, materialInfo.clearcoatF0, 1.0);
            `: ''}
        }
    `

    return code;
}

export default generate;
