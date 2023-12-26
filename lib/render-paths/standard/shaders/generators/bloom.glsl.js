import { Frustum } from '../../../../frustum.js';

import fullscreenVert from '../../../common/shaders/generators/fullscreen.vert.glsl.js';

const frustumUniformBlock  = Frustum.generateUniformBlock('glsl', 1, 0);

export function generate({ input: { mode = 'extract', settings } }) {
    const vertex = fullscreenVert();

    const settingsUniformBlock = settings.generateUniformBlock(0, 0);

    const modes = {
        extract: /* glsl */`
            ${settingsUniformBlock}
            ${frustumUniformBlock}

            #pragma revTextureBinding(colorTexture, 2, 1, 0)
            uniform sampler2D colorTexture;

            vec4 prefilter(vec4 c) {
                float brightness = max(c.r, max(c.g, c.b));
                float soft = brightness - settings.bloom.knee.y;
                soft = clamp(soft, 0.0, settings.bloom.knee.z);
                soft = soft * soft * settings.bloom.knee.w;
                float contribution = max(soft, brightness - settings.bloom.knee.x);
                contribution = contribution / max(brightness, 0.00001);
                return c * contribution;
            }

            void main(void) {
                g_finalColor = prefilter(texture(colorTexture, texCoord));
            }
        `,
        mix: /* glsl */`
            ${settingsUniformBlock}
            ${frustumUniformBlock}

            #pragma revTextureBinding(colorTexture, 2, 1, 0)
            uniform sampler2D colorTexture;

            #pragma revTextureBinding(bloomTexture, 2, 2, 0)
            uniform sampler2D bloomTexture;

            void main(void) {
                vec4 color = texture(colorTexture, texCoord);
                vec4 bloom = texture(bloomTexture, texCoord);
                g_finalColor = color + bloom * settings.bloom.intensity;
            }
        `,
    }

    const fragment = /* glsl */`#version 300 es
        precision highp float;

        in vec2 texCoord;

        layout(location=0) out vec4 g_finalColor;

        ${modes[mode]}
    `;

    return { vertex, fragment };
}

export default generate;
