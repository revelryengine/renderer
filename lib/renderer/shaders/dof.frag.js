/**
 * This is a very simple depth of field shader
 * 
 * Should be used with simple.vert.js vertex shader.
 */
 const glsl = String.raw; // For syntax-highlighting
export const fragmentShader = glsl`
/********** dof.frag.js **********/
precision highp float;

uniform sampler2D u_DepthSampler;
uniform sampler2D u_InFocusSampler;
uniform sampler2D u_OutFocusSampler;

uniform float u_Distance;
uniform float u_Range;
uniform float u_Near;
uniform float u_Far;

in vec2 v_TexCoord;

out vec4 g_finalColor;

float getLinearDepth(float d) {
    return u_Near * u_Far / (u_Far + d * (u_Near - u_Far));
}

void main(void) {
    vec4 inFocusColor  = texture(u_InFocusSampler, v_TexCoord);
    vec4 outFocusColor = texture(u_OutFocusSampler, v_TexCoord);

    float depth = getLinearDepth(texture(u_DepthSampler, v_TexCoord).x);
    float blur = clamp(abs((depth - u_Distance) / u_Range), 0.0, 1.0);
    g_finalColor = mix(inFocusColor, outFocusColor, blur);
}
/********** dof.frag.js **********/
`;

export default fragmentShader;
