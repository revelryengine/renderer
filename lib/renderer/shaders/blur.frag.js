/**
 * @see https://learnopengl.com/Advanced-Lighting/SSAO
 * @see https://mynameismjp.wordpress.com/2010/09/05/position-from-depth-3/
 * @see https://www.derschmale.com/2014/01/26/reconstructing-positions-from-the-depth-buffer/
 * @see https://www.khronos.org/opengl/wiki/Compute_eye_space_from_window_space
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
   g_finalColor.r = result / float(u_BlurSize * u_BlurSize);
}
/********** blur.frag.js **********/
`;

export default fragmentShader;
