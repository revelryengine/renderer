/**
 * This is a simple shader that outputs a solid color.
 */
const glsl = String.raw; // For syntax-highlighting
export const fragmentShader = glsl`
/********** solid.frag.js **********/
precision highp float;

uniform vec4 u_Color;

out vec4 g_finalColor;

void main(void) {
    g_finalColor = u_Color;
}
/********** /solid.frag.js **********/
`;

export default fragmentShader;
