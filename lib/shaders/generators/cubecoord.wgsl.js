export function generate() {
    const code = /* wgsl */`
    
        const coordMapping = array<vec3<i32>, 6>(
            vec3<i32>(2, 1, 0), 
            vec3<i32>(2, 1, 0), 
            vec3<i32>(0, 2, 1), 
            vec3<i32>(0, 2, 1), 
            vec3<i32>(0, 1, 2), 
            vec3<i32>(0, 1, 2)
        );

        const signMapping = array<vec3<f32>, 6>(
            vec3<f32>( 1.0,-1.0,-1.0),
            vec3<f32>(-1.0,-1.0, 1.0),
            vec3<f32>( 1.0, 1.0, 1.0),
            vec3<f32>( 1.0,-1.0,-1.0),
            vec3<f32>( 1.0,-1.0, 1.0),
            vec3<f32>(-1.0,-1.0,-1.0)
        );

        fn cubeCoord(uv: vec2<f32>, face: i32) -> vec3<f32> {
            var coord    = vec3<f32>(uv.x, uv.y, 1.0);
            var coordVec = coordMapping[face];
            var signVec  = signMapping[face];
            return normalize(vec3<f32>(coord[coordVec[0]], coord[coordVec[1]], coord[coordVec[2]]) * signVec);
        }
    `;
    
    return code;
}

export default generate;