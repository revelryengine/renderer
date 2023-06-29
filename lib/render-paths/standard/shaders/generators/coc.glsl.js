import { Frustum  } from '../../../../frustum.js';

import generateUniformBlock from '../../../common/shaders/generators/uniform.glsl.js';

import { Settings } from '../../settings.js';

const settingsUniformBlock = generateUniformBlock(Settings, 0, 0);
const frustumUniformBlock  = generateUniformBlock(Frustum, 1, 0);

export function generate() {
    const vertex = /* glsl */`#version 300 es
        precision highp float;
        precision highp int;

        ${settingsUniformBlock}
        ${frustumUniformBlock}
        
        out vec2 texCoord;
        out float cocPrecalc;

        void main(void) {
            int id  = gl_VertexID % 3;
            float x = float((id & 1) << 2);
            float y = float((id & 2) << 1);

            texCoord = vec2(x * 0.5, y * 0.5);

            float aperture = settings.lens.size / settings.lens.fStop;
            cocPrecalc = (aperture * settings.lens.focalLength) / (settings.lens.focalDistance - settings.lens.focalLength);
            
            gl_Position = vec4(x - 1.0, y - 1.0, 0, 1);
        }
    `;

    const fragment = /* glsl */`#version 300 es
        precision highp float;

        ${settingsUniformBlock}
        ${frustumUniformBlock}

        float getLinearDepth(float d) {
            return frustum.near * frustum.far / (frustum.far + d * (frustum.near - frustum.far));
        }

        #pragma revTextureBinding(depthTexture, 2, 1, 0)
        uniform sampler2D depthTexture;

        in vec2 texCoord;
        in float cocPrecalc;

        layout(location=0) out vec4 g_finalColor;
        
        void main(void) {
            float dist = getLinearDepth(texture(depthTexture, texCoord).r);
            float coc = abs(cocPrecalc * (((settings.lens.focalDistance / 1000.0) - dist) / dist));
            coc = clamp(coc, 0.0, 1.0);
            g_finalColor = vec4(coc, dist, coc, 1.0);
        }
    `;
    
    return { vertex, fragment };
}

export default generate;