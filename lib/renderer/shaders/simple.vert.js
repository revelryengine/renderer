/**
 * This vertex shader is a simple vertex shader useful for full screen passes.
 * To use draw a triangle fan (i.e `gl.drawArrays(gl.TRIANGLE_FAN, 0, 3);`)
 */
const glsl = String.raw; // For syntax-highlighting
export const vertexShader = glsl`
/********** simple.vert.js **********/
precision highp float;

uniform vec2 u_HalfSizeNearPlane;

out vec2 v_TexCoord;
out vec3 v_ViewRay;

void main(void) 
{
    float x = float((gl_VertexID & 1) << 2);
    float y = float((gl_VertexID & 2) << 1);

    v_TexCoord.x = x * 0.5;
    v_TexCoord.y = y * 0.5;

    v_ViewRay = vec3((2.0 * u_HalfSizeNearPlane * v_TexCoord) - u_HalfSizeNearPlane, -1.0);

    gl_Position = vec4(x - 1.0, y - 1.0, 0, 1);
}
/********** simple.vert.js **********/
`;

export default vertexShader;
