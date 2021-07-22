/**
 * Should be used with simple.vert.js vertex shader.
 * 
 * @todo - Add bilateral filtering based on depth
 * @see https://stackoverflow.com/questions/6538310/anyone-know-where-i-can-find-a-glsl-implementation-of-a-bilateral-filter-blur/6538650
 * @see https://www.gamasutra.com/blogs/PeterWester/20140116/208742/Generating_smooth_and_cheap_SSAO_using_Temporal_Blur.php
 */
 const glsl = String.raw; // For syntax-highlighting
export const fragmentShader = glsl`
/********** blur.frag.js **********/
precision highp float;

uniform sampler2D u_InputSampler;
uniform int u_BlurSize;

in vec2 v_TexCoord;

out vec4 g_finalColor;

void main(void) 
{    
    vec2 texelSize = 1.0 / vec2(textureSize(u_InputSampler, 0));
    float result = 0.0;
    vec2 hlim = vec2(float(-u_BlurSize) * 0.5 + 0.5);
    for (int i = 0; i < u_BlurSize; ++i) {
        for (int j = 0; j < u_BlurSize; ++j) {
            vec2 offset = (hlim + vec2(float(i), float(j))) * texelSize;
            result += texture(u_InputSampler, v_TexCoord + offset).r;
        }
    }
    g_finalColor = vec4(vec3(result / float(u_BlurSize * u_BlurSize)), 1.0);
}
/********** blur.frag.js **********/
`;

export default fragmentShader;
