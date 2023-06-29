import fullscreenVert from './fullscreen.vert.wgsl.js';

export function generate() {
    const vertex = fullscreenVert();

    const fragment = /* wgsl */`

        struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) texCoord: vec2<f32>,
            @location(1) @interpolate(flat) texLayer: i32,
        };

        struct FragmentOutput {
            @location(0) color: vec4<f32>,
        };
        
        @fragment
        fn main(in: VertexOutput) -> FragmentOutput {
            var out: FragmentOutput;

            out.color = vec4<f32>(in.texCoord.x, in.texCoord.y, f32(in.texLayer), 1.0);

            return out;
        }
    `;
    
    return { vertex, fragment };
}

export default generate;