import { Frustum     } from '../../../../frustum.js';
import { Environment } from '../../../../environment.js';

import fullscreenVert       from '../../../common/shaders/generators/fullscreen.vert.glsl.js';

const frustumUniformBlock     = Frustum.generateUniformBlock('glsl', 1, 0);
const environmentUniformBlock = Environment.generateUniformBlock('glsl', 2, '$$binding');

/**
 * References:
 *
 * @see https://webglfundamentals.org/webgl/lessons/webgl-skybox.html
 */
export function generate({ locations, input: { settings } }) {
    const vertex = fullscreenVert();

    const { bindGroup } = locations;

    const settingsUniformBlock = settings.generateUniformBlock(0, 0);

    const fragment = /* glsl */`#version 300 es
        precision highp float;

        ${settingsUniformBlock}
        ${frustumUniformBlock}
        ${environmentUniformBlock.replace('$$binding', bindGroup.environment)}

        #pragma revTextureBinding(envGGX, 2, ${bindGroup.envGGX}, ${bindGroup.envSampler})
        uniform samplerCube envGGX;

        in vec2 texCoord;

        layout(location=0) out vec4 g_finalColor;

        vec4 linearTosRGBA(vec4 color) {
            return pow(color, vec4(1.0 / 2.2));
        }

        void main(void) {
            vec4 t = frustum.invViewProjectionMatrix * vec4(texCoord * 2.0 - 1.0, 1.0, 1.0);

            float level = mix(0.0, float(environment.mipLevelCount - 1), settings.skybox.blur);

            g_finalColor = linearTosRGBA(textureLod(envGGX, normalize(t.xyz / t.w), level));
        }
    `;

    return { vertex, fragment };
}

export default generate;
