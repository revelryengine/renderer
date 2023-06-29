import fullscreenVert from '../../../../common/shaders/generators/fullscreen.vert.glsl.js';

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
            float revealage = texture(revealTexture, texCoord).r;

            // // save the blending and color texture fetch cost if there is not a transparent fragment
            if (isApproximatelyEqual(revealage, 1.0)){
                discard;
            }

            // fragment color
            vec4 accumulation = texture(accumTexture, texCoord);

            // suppress overflow
            if (isinf(max3(abs(accumulation.rgb)))){
                accumulation.rgb = vec3(accumulation.a);
            }

            // prevent floating point precision bug
            vec3 average_color = accumulation.rgb / max(accumulation.a, EPSILON);
            
            g_finalColor = vec4(average_color, 1.0 - revealage); 
        }
    `;
    
    return { vertex, fragment };
}

export default generate;