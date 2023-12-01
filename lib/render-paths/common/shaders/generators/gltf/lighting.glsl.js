import generateEnvironmentBlock  from './environment.glsl.js';
import generatePunctualBlock     from './punctual.glsl.js';
import generateTransmissionBlock from './transmission.glsl.js';

export function generate({ flags, locations }) {

    const { bindGroup } = locations;

    const code = /* glsl */`
        struct LightInfo {
            vec3 specular;
            vec3 diffuse;
            vec3 irradiance;
            vec3 sheen;
            vec3 clearcoat;
            vec3 transmission;
            float occlusion;
        };

        LightInfo getLightInfo() {
            LightInfo lightInfo;

            lightInfo.specular     = vec3(0.0);
            lightInfo.diffuse      = vec3(0.0);
            lightInfo.clearcoat    = vec3(0.0);
            lightInfo.sheen        = vec3(0.0);
            lightInfo.transmission = vec3(0.0);
            lightInfo.irradiance   = vec3(0.0);
            return lightInfo;
        }

        LightInfo lightInfo;

        ${flags.useEnvironment  ? generateEnvironmentBlock({ flags, locations }): ''}
        ${flags.useTransmission ? generateTransmissionBlock({ flags, locations }): ''}
        ${flags.usePunctual     ? generatePunctualBlock({ flags, locations }): ''}

        ${flags.useSSAO ? /* glsl */`
        #pragma revTextureBinding(ssaoTexture, 2, ${bindGroup.ssaoTexture}, ${bindGroup.ssaoSampler})
        uniform sampler2D ssaoTexture;
        `: ''}

        void applyOcclusion(vec2 coord) {
            float ao = materialInfo.occlusion;

            ${flags.useSSAO ? /* glsl */`
                ao = texture(ssaoTexture, coord.xy / vec2(frustum.width, frustum.height)).r;

                // for SSAO use min(ssao, materialInfo.occlusion) https://google.github.io/filament/Filament.md.html#toc5.6
                ${flags.hasTexture?.occlusionTexture ? /* glsl */`
                    ao = min(ao, materialInfo.occlusion);
                `: ''}
            `: ''}

            lightInfo.diffuse   = mix(lightInfo.diffuse  , lightInfo.diffuse   * ao, material.occlusionStrength);
            lightInfo.specular  = mix(lightInfo.specular , lightInfo.specular  * ao, material.occlusionStrength);
            lightInfo.sheen     = mix(lightInfo.sheen    , lightInfo.sheen     * ao, material.occlusionStrength);
            lightInfo.clearcoat = mix(lightInfo.clearcoat, lightInfo.clearcoat * ao, material.occlusionStrength);
            lightInfo.occlusion = ao;
        }

        vec4 applyLighting() {
            vec3 color = vec3(0.0);

            float albedoSheenScaling = 1.0;

            color = materialInfo.emissive + lightInfo.diffuse + lightInfo.specular;
            color = lightInfo.sheen + color * albedoSheenScaling;
            color = color * (1.0 - materialInfo.clearcoatFactor * materialInfo.clearcoatFresnel) + (lightInfo.clearcoat * materialInfo.clearcoatFactor);

            return vec4(color, materialInfo.baseColor.a);
        }

        vec3 applyToneMap(vec3 color, float exposure) {
            vec3 c = color * exposure;

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
