import { Settings } from '../../settings.js';
import { Frustum  } from '../../frustum.js';

import generateUniformBlock  from './uniform.glsl.js';

import fullscreenVert from './fullscreen.vert.glsl.js';

const settingsUniformBlock = generateUniformBlock(Settings, 0, 0);
const frustumUniformBlock  = generateUniformBlock(Frustum, 1, 0);

export function generate() {
    const vertex = fullscreenVert();

    const fragment = /* glsl */`#version 300 es
        precision highp float;

        ${settingsUniformBlock}
        ${frustumUniformBlock}

        in vec2 texCoord;

        layout(location=0) out vec4 g_finalColor;
        
        void main(void) {
            g_finalColor = vec4(texCoord.x, texCoord.y, settings.ssao.radius, 1.0);
        }
    `;
    
    return { vertex, fragment };
}

export default generate;