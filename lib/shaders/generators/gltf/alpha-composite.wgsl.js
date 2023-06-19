import fullscreenVert from '../fullscreen.vert.wgsl.js';

export function generate() {
    const vertex = fullscreenVert();

    const fragment = /* wgsl */`

        @group(0) @binding(0) var texSampler:    sampler;
        @group(0) @binding(1) var accumTexture:  texture_2d<f32>;
        @group(0) @binding(2) var revealTexture: texture_2d<f32>;

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

            var accum = textureLoad(accumTexture, vec2<i32>(in.texCoord), 0);
            var r = accum.a;
            accum.a = textureLoad(revealTexture, vec2<i32>(in.texCoord), 0).r;
            out.color = vec4<f32>(accum.rgb / clamp(accum.a, 1e-4, 5e4), r);
            out.color = vec4<f32>(1.0, 0.0, 0.0, 1.0);

            return out;
        }
    `;
    
    return { vertex, fragment };
}

export default generate;