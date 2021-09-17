/**
 * This vertex shader is a simple vertex shader useful for full screen passes.
 * To use draw a triangle fan (i.e `gl.drawArrays(gl.TRIANGLE_FAN, 0, 3);`)
 */
const glsl = String.raw; // For syntax-highlighting
export const vertexShader = glsl`
/********** simple.vert.js **********/
precision highp float;

out vec2 v_TexCoord;

void main(void) {
    float x = float((gl_VertexID & 1) << 2);
    float y = float((gl_VertexID & 2) << 1);

    v_TexCoord = vec2(x * 0.5, y * 0.5);
    gl_Position = vec4(x - 1.0, y - 1.0, 0, 1);
}
/********** simple.vert.js **********/
`;

export default vertexShader;
