import generateEnvironmentBlock  from './environment.wgsl.js';
import generatePunctualBlock     from './punctual.wgsl.js';
import generateTransmissionBlock from './transmission.wgsl.js';

export function generate({ flags, locations, punctual }) {

    const { bindGroup } = locations;

    const code = /* wgsl */`
        struct LightInfo {
            specular     : vec3<f32>,
            diffuse      : vec3<f32>,
            irradiance   : vec3<f32>,
            sheen        : vec3<f32>,
            clearcoat    : vec3<f32>,
            transmission : vec3<f32>,
            occlusion    : f32,
        };

        fn getLightInfo() -> LightInfo {
            var lightInfo: LightInfo;

            lightInfo.specular     = vec3<f32>(0.0);
            lightInfo.diffuse      = vec3<f32>(0.0);
            lightInfo.clearcoat    = vec3<f32>(0.0);
            lightInfo.sheen        = vec3<f32>(0.0);
            lightInfo.transmission = vec3<f32>(0.0);
            lightInfo.irradiance   = vec3<f32>(0.0);

            return lightInfo;
        }

        var<private> lightInfo: LightInfo;

        ${flags.useEnvironment  ? generateEnvironmentBlock({ flags, locations }): ''}
        ${flags.useTransmission ? generateTransmissionBlock({ flags, locations }): ''}
        ${flags.usePunctual     ? generatePunctualBlock({ flags, locations, punctual }): ''}

        ${flags.useSSAO ? /* glsl */`
        @group(2) @binding(${bindGroup.ssaoSampler}) var ssaoSampler: sampler;
        @group(2) @binding(${bindGroup.ssaoTexture}) var ssaoTexture: texture_2d<f32>;
        `: ''}

        fn applyOcclusion(coord: vec2<f32>) {
            var ao = materialInfo.occlusion;

            ${flags.useSSAO ? /* wgsl */`
                ao = textureSample(ssaoTexture, ssaoSampler, coord.xy / vec2<f32>(frustum.width, frustum.height)).r;

                // for SSAO use min(ssao, materialInfo.occlusion) https://google.github.io/filament/Filament.md.html#toc5.6
                ${flags.hasTexture?.occlusionTexture ? /* wgsl */`
                    ao = min(ao, materialInfo.occlusion);
                `: ''}
            `: ''}

            lightInfo.diffuse   = mix(lightInfo.diffuse  , lightInfo.diffuse   * ao, material.occlusionStrength);
            lightInfo.specular  = mix(lightInfo.specular , lightInfo.specular  * ao, material.occlusionStrength);
            lightInfo.sheen     = mix(lightInfo.sheen    , lightInfo.sheen     * ao, material.occlusionStrength);
            lightInfo.clearcoat = mix(lightInfo.clearcoat, lightInfo.clearcoat * ao, material.occlusionStrength);
            lightInfo.occlusion = ao;
        }

        fn applyLighting() -> vec4<f32> {
            var color = vec3<f32>(0.0);

            var albedoSheenScaling = 1.0;

            color = materialInfo.emissive + lightInfo.diffuse + lightInfo.specular;
            color = lightInfo.sheen + color * albedoSheenScaling;
            color = color * (1.0 - materialInfo.clearcoatFactor * materialInfo.clearcoatFresnel) + (lightInfo.clearcoat * materialInfo.clearcoatFactor);

            return vec4<f32>(color, materialInfo.baseColor.a);
        }

        fn applyToneMap(color: vec3<f32>, exposure: f32) -> vec3<f32> {
            var c = color * exposure;

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
