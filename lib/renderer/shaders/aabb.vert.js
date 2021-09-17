import { frustum } from './frustum.glsl.js';

/**
 * This is a very simple shader to render bounding boxes
 * 
 * Should be used with simple.vert.js vertex shader.
 */
 const glsl = String.raw; // For syntax-highlighting
export const vertexShader = glsl`
/********** aabb.vert.js **********/
precision highp float;

${frustum}

uniform vec3 u_Min;
uniform vec3 u_Max;

const vec3 cube[8] = vec3[](
    // front face
    vec3(-1,-1, 1),
    vec3(-1, 1, 1),
    vec3( 1, 1, 1),
    vec3( 1,-1, 1),
    

    // back face
    vec3(-1,-1,-1),
    vec3(-1, 1,-1),
    vec3( 1, 1,-1),
    vec3( 1,-1,-1)
);

const int indices[24] = int[](
    0, 1,   1, 2,   2, 3,   3, 0, // front
    4, 5,   5, 6,   6, 7,   7, 4, // back
    0, 4,   1, 5,   2, 6,   3, 7  // sides
);

void main(void) {
    vec3 center  = (u_Min + u_Max) * 0.5; 
    vec3 extents = (u_Min - u_Max) * 0.5;

    vec3 pos = (center + (cube[indices[gl_VertexID]] * extents));

    gl_Position = u_ViewProjectionMatrix * vec4(pos, 1.0);
}
/********** aabb.vert.js **********/
`;

export default vertexShader;
