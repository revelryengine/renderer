import fullscreenVert from './fullscreen.vert.glsl.js';

/**
 * References:
 * 
 * @see https://dipaola.org/art/wp-content/uploads/2017/09/cgf2012.pdf
 * @see http://tuxedolabs.blogspot.com/2018/05/bokeh-depth-of-field-in-single-pass.html?m=1
 */

export function generate() {
    const vertex = fullscreenVert();

    const fragment = /* glsl */`#version 300 es
        precision highp float;

        #pragma revTextureBinding(colorTexture, 2, 1, 0)
        uniform sampler2D colorTexture;

        #pragma revTextureBinding(cocTexture, 2, 2, 0)
        uniform sampler2D cocTexture;

        in vec2 texCoord;

        layout(location=0) out vec4 g_finalColor;

        const float GOLDEN_ANGLE  = 2.39996323;
        const float MAX_BLUR_SIZE = 20.0;
        const float RAD_SCALE     = 1.0; // Smaller = nicer blur, larger = faster

        vec4 depthOfField(vec2 texCoord) {
            vec2 texelSize = 1.0 / vec2(textureSize(colorTexture, 0));

            vec2  centerCoC   = texture(cocTexture, texCoord).rg;
            float centerSize  = abs(centerCoC.r) * MAX_BLUR_SIZE;
            float centerDepth = centerCoC.g;
            
            vec4 color = texture(colorTexture, texCoord);

            float tot = 1.0;

            float radius = RAD_SCALE;
            for (float ang = 0.0; radius < MAX_BLUR_SIZE; ang = ang + GOLDEN_ANGLE) {

                vec2 tc = texCoord + vec2(cos(ang), sin(ang)) * texelSize * radius;

                vec4  sampleColor = texture(colorTexture, tc);
                vec2  sampleCoC   = texture(cocTexture, texCoord).rg;
                float sampleSize  = abs(sampleCoC.r) * MAX_BLUR_SIZE;
                float sampleDepth = sampleCoC.g;

                if (sampleDepth > centerDepth + 0.05){
                    sampleSize = clamp(sampleSize, 0.0, centerSize * 2.0);
                }

                float m = smoothstep(radius - 0.5, radius + 0.5, sampleSize);
                color = color + mix(color/tot, sampleColor, m);
                tot = tot + 1.0;
                radius = radius + RAD_SCALE / radius;
            }
            return color / tot;
        }
        
        void main(void) {
            g_finalColor = depthOfField(texCoord);
        }
    `;
    
    return { vertex, fragment };
}

export default generate;