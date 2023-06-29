import fullscreenVert from './fullscreen.vert.glsl.js';

/**
 * References:
 * 
 * @see https://www.elopezr.com/temporal-aa-and-the-quest-for-the-holy-trail/
 * @see https://alextardif.com/TAA.html
 * @see https://sugulee.wordpress.com/2021/06/21/temporal-anti-aliasingtaa-tutorial/
 */

export function generate() {
    const vertex = fullscreenVert();

    const fragment = /* glsl */`#version 300 es
        precision highp float;

        #pragma revTextureBinding(colorTexture, 2, 1, 0)
        uniform sampler2D colorTexture;

        #pragma revTextureBinding(motionTexture, 2, 3, 2)
        uniform sampler2D motionTexture;

        #pragma revTextureBinding(historyTexture, 2, 5, 4)
        uniform sampler2D historyTexture;

        in vec2 texCoord;

        layout(location=0) out vec4 g_finalColor;
        
        void main(void) {
            vec2 velocity = texture(motionTexture, texCoord).xy;
            vec2 historyCoord = texCoord - velocity;

            vec4 currentColor = texture(colorTexture, texCoord);
            vec4 historyColor = texture(historyTexture, historyCoord);
            
            // Apply clamping on the history color.
            vec4 nearColor0 = textureOffset(colorTexture, texCoord, ivec2(1, 0));
            vec4 nearColor1 = textureOffset(colorTexture, texCoord, ivec2(0, 1));
            vec4 nearColor2 = textureOffset(colorTexture, texCoord, ivec2(-1, 0));
            vec4 nearColor3 = textureOffset(colorTexture, texCoord, ivec2(0, -1));
            
            vec4 boxMin = min(currentColor, min(nearColor0, min(nearColor1, min(nearColor2, nearColor3))));
            vec4 boxMax = max(currentColor, max(nearColor0, max(nearColor1, max(nearColor2, nearColor3))));;
            
            historyColor = clamp(historyColor, boxMin, boxMax);
            
            float modulationFactor = 0.9;

            g_finalColor = mix(currentColor, historyColor, modulationFactor);
        }
    `;
    
    return { vertex, fragment };
}

export default generate;