import fullscreenVert from '../fullscreen.vert.glsl.js';


/**
 * @see https://learnopengl.com/Guest-Articles/2020/OIT/Weighted-Blended
 */

export function generate() {
    const vertex = fullscreenVert();

    const fragment = /* glsl */`#version 300 es
        precision highp float;

        #pragma revTextureBinding(accumTexture, 0, 1, 0)
        uniform sampler2D accumTexture;

        #pragma revTextureBinding(revealTexture, 0, 2, 0)
        uniform sampler2D revealTexture;

        in vec2 texCoord;

        layout(location=0) out vec4 g_finalColor;

        // epsilon number
        const float EPSILON = 0.00001;

        // calculate floating point numbers equality accurately
        bool isApproximatelyEqual(float a, float b) {
            return abs(a - b) <= EPSILON;
        }

        // get the max value between three values
        float max3(vec3 v) {
            return max(max(v.x, v.y), v.z);
        }

        void main(void) {
            vec4 accum = texture(accumTexture, texCoord);
            float r = accum.a;

            // save the blending and color texture fetch cost if there is not a transparent fragment
            if (isApproximatelyEqual(r, 0.0)){
                discard;
            }

            accum.a = texture(revealTexture, texCoord).r;

            // suppress overflow
            if (isinf(max3(abs(accum.rgb)))) {
                accum.rgb = vec3(accum.a);
            }

            vec3 average_color = accum.rgb / max(accum.a, EPSILON);
            
            g_finalColor = vec4(average_color, r);
        }
    `;
    
    return { vertex, fragment };
}

export default generate;