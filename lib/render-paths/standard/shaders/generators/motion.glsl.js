import fullscreenVert       from '../../../common/shaders/generators/fullscreen.vert.glsl.js';
import generateUniformBlock from '../../../common/shaders/generators/uniform.glsl.js';

import { Settings } from '../../settings.js';

const settingsUniformBlock = generateUniformBlock(Settings, 0, 0);

/**
 * References:
 * 
 * @see https://lettier.github.io/3d-game-shaders-for-beginners/motion-blur.html
 * @see https://ogldev.org/www/tutorial41/tutorial41.html
 * @see https://developer.nvidia.com/gpugems/gpugems3/part-iv-image-effects/chapter-27-motion-blur-post-processing-effect
 */

export function generate() {
    const vertex = fullscreenVert();

    const fragment = /* glsl */`#version 300 es
        precision highp float;

        ${settingsUniformBlock}

        #pragma revTextureBinding(colorTexture, 2, 1, 0)
        uniform sampler2D colorTexture;

        #pragma revTextureBinding(motionTexture, 2, 3, 2)
        uniform sampler2D motionTexture;

        in vec2 texCoord;

        layout(location=0) out vec4 g_finalColor;
        
        void main(void) {
            vec2 motion = (texture(motionTexture, texCoord).xy * settings.motionBlur.scale) / 2.0;
            
            vec4 color = vec4(0.0);
            vec2 coord = texCoord;

            color += texture(colorTexture, coord) * 0.4;
            coord -= motion;
            color += texture(colorTexture, coord) * 0.3;
            coord -= motion;
            color += texture(colorTexture, coord) * 0.2;
            coord -= motion;
            color += texture(colorTexture, coord) * 0.1;

            g_finalColor = color;
        }
    `;
    
    return { vertex, fragment };
}

export default generate;