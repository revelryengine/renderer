export function generate() {
    const code = /* glsl */`

        const ivec3 coordMapping[6] = ivec3[](
            ivec3(2, 1, 0), 
            ivec3(2, 1, 0), 
            ivec3(0, 2, 1), 
            ivec3(0, 2, 1), 
            ivec3(0, 1, 2), 
            ivec3(0, 1, 2)
        );

        const vec3 signMapping[6] = vec3[](
            vec3( 1.0,-1.0,-1.0),
            vec3(-1.0,-1.0, 1.0),
            vec3( 1.0, 1.0, 1.0),
            vec3( 1.0,-1.0,-1.0),
            vec3( 1.0,-1.0, 1.0),
            vec3(-1.0,-1.0,-1.0)
        );

        vec3 cubeCoord(vec2 uv, int face) {
            vec3 coord     = vec3(uv.x, uv.y, 1.0);
            ivec3 coordVec = coordMapping[face];
            vec3 signVec   = signMapping[face];
            return normalize(vec3(coord[coordVec[0]], coord[coordVec[1]], coord[coordVec[2]]) * signVec);
        }
    `;
    
    return code;
}

export default generate;