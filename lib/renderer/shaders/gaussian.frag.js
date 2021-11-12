/**
 * Should be used with simple.vert.js vertex shader.
 * 
 * References:
 * 
 * @see https://stackoverflow.com/questions/6538310/anyone-know-where-i-can-find-a-glsl-implementation-of-a-bilateral-filter-blur/6538650
 * @see https://www.gamasutra.com/blogs/PeterWester/20140116/208742/Generating_smooth_and_cheap_SSAO_using_Temporal_Blur.php
 * @see https://github.com/mattdesl/lwjgl-basics/wiki/ShaderLesson5
 * @see https://rastergrid.com/blog/2010/09/efficient-gaussian-blur-with-linear-sampling/
 */
 const glsl = String.raw; // For syntax-highlighting
export const fragmentShader = glsl`
/********** gaussian.frag.js **********/
precision highp float;

/*layout(binding = 0)*/uniform sampler2D u_InputSampler;

in vec2 v_TexCoord;

out vec4 g_finalColor;

const int sampleCount = 3;
const float colorSamples[3]  = float[](0.0, 1.3846153846, 3.2307692308);
const float gaussianCoeff[3] = float[](0.2270270270, 0.3162162162, 0.0702702703);

void main(void) {
    vec2 texelSize = 1.0 / vec2(textureSize(u_InputSampler, 0));

    #ifdef DIRECTION_HORIZONTAL
    vec2 offsetScale = vec2(1.0, 0.0) * texelSize;
    #else
    vec2 offsetScale = vec2(0.0, 1.0) * texelSize;
    #endif
    
    

    #ifdef BILATERAL
        /** I have no idea if this is right but it does look slightly better. 
         * The closeness function is currently base on color distance at the moment. 
         * This is because I am trying to make SSAO tighter after the blur and reduce halo artifacts. */
        vec4 centerColor = texture(u_InputSampler, v_TexCoord);
        vec4 result = centerColor * 2.0 * gaussianCoeff[0];
        float normalization = 2.0 * gaussianCoeff[0];
        for (int i = 1; i < sampleCount; i++) {
            vec2 offset = colorSamples[i] * offsetScale;

            vec4 a = texture(u_InputSampler, v_TexCoord + offset);
            vec4 b = texture(u_InputSampler, v_TexCoord - offset);

            float aCloseness = 1.0 - distance(a, centerColor) / length(vec4(1.0));
            float bCloseness = 1.0 - distance(b, centerColor) / length(vec4(1.0));

            float aWeight = gaussianCoeff[i] * aCloseness;
            float bWeight = gaussianCoeff[i] * bCloseness;

            result += a * aWeight;
            result += b * bWeight;

            normalization += aWeight + bWeight;
        }
        g_finalColor = result / normalization;
    #else
        g_finalColor = texture(u_InputSampler, v_TexCoord) * gaussianCoeff[0];
        for (int i = 1; i < sampleCount; i++) {
            vec2 offset = offsetScale * colorSamples[i];
            g_finalColor += texture(u_InputSampler, v_TexCoord + offset) * gaussianCoeff[i];
            g_finalColor += texture(u_InputSampler, v_TexCoord - offset) * gaussianCoeff[i];
            
        }
    #endif
}
/********** /gaussian.frag.js **********/
`;

export default fragmentShader;
