import { frustum } from './frustum.glsl.js';

/**
 * This is a shader to render a reference grid
 * 
 * Should be used with grid.frag.js vertex shader.
 */
 const glsl = String.raw; // For syntax-highlighting
export const vertexShader = glsl`
/********** grid.vert.js **********/
precision highp float;

${frustum}

uniform float u_Extent;
out vec3 v_WorldPosition;

vec3 gridPlane[6] = vec3[](
    vec3( 1, 0, 1), vec3(-1, 0,-1), vec3(-1, 0, 1),
    vec3(-1, 0,-1), vec3( 1, 0, 1), vec3( 1, 0,-1)
);

void main(void) {
    vec3 pos = gridPlane[gl_VertexID] * u_Extent;
    pos.xz += u_FrustumPosition.xz;
    v_WorldPosition = pos;
    gl_Position = u_ViewProjectionMatrix * vec4(pos, 1.0);
}
/********** /grid.vert.js **********/
`;

export default vertexShader;
