/**
 * This is a simple shader that outputs ids and depth to color textures.
 */
 const glsl = String.raw; // For syntax-highlighting
export const fragmentShader = glsl`
/********** input.frag.js **********/
precision highp float;

uniform uint u_Id;

layout(location = 0) out vec4 g_id;
layout(location = 1) out vec4 g_z;

void main(void) {
    g_id.r = float(u_Id);
    g_z.r = gl_FragCoord.z;
}
/********** input.frag.js **********/
`;

export default fragmentShader;
