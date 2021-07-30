/**
 * This is a simple shader that does not output anything. Useful for depth only passes such as shadow maps.
 */
 const glsl = String.raw; // For syntax-highlighting
export const fragmentShader = glsl`
/********** empty.frag.js **********/
precision highp float;

out vec4 g_finalColor;

void main(void) {
    g_finalColor = vec4(vec3(gl_FragCoord.z), 1.0);

    // gl_FragDepth = gl_FragCoord.z;// + (0.003 * (1.0 - (gl_FragCoord.z * 0.5 + 0.5)));
}
/********** empty.frag.js **********/
`;

export default fragmentShader;
