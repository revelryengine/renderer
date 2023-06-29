export function generate() {
    const code = /* wgsl */`
        struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) texCoord: vec2<f32>,
            @location(1) @interpolate(flat) texLayer: i32,
        };

        @vertex
        fn main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
            var vertexID = i32(VertexIndex);
            var id = vertexID % 3;
            var x  = f32(u32(id & 1) << 2u);
            var y  = f32(u32(id & 2) << 1u);
    
            var out : VertexOutput;
            out.texCoord = vec2<f32>(x * 0.5, y * 0.5);
            out.texLayer = i32((vertexID - (vertexID % 3)) / 3);

            out.position = vec4<f32>(x - 1.0, 1.0 - y, 1.0, 1.0);
            
            return out;
        }
    `;
    
    return code;
}

export default generate;