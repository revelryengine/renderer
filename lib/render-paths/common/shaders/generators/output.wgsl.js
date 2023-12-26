import { Frustum } from '../../../../frustum.js';

const frustumUniformBlock  = Frustum.generateUniformBlock('wgsl', 0, 0);

export function generate() {
    const vertex = /* wgsl */`

        ${frustumUniformBlock}

        @group(1) @binding(0) var colorSampler: sampler;
        @group(1) @binding(1) var colorTexture: texture_2d<f32>;

        struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) texCoord: vec2<f32>,
        };

        @vertex
        fn main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
            var vertexID = i32(VertexIndex);
            var id = vertexID % 3;
            var x  = f32(u32(id & 1) << 2u);
            var y  = f32(u32(id & 2) << 1u);

            var out : VertexOutput;

            var size = vec2<f32>(textureDimensions(colorTexture));
            out.texCoord = vec2<f32>(x * 0.5, y * 0.5) * (vec2<f32>(frustum.width, frustum.height) / size);

            out.position = vec4<f32>(x - 1.0, 1.0 - y, 1.0, 1.0);

            return out;
        }
    `;

    const fragment = /* wgsl */`
        @group(1) @binding(0) var colorSampler: sampler;
        @group(1) @binding(1) var colorTexture: texture_2d<f32>;

        struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) texCoord: vec2<f32>,
        };

        struct FragmentOutput {
            @location(0) color: vec4<f32>,
        };

        @fragment
        fn main(in: VertexOutput) -> FragmentOutput {
            var out: FragmentOutput;
            out.color = textureSample(colorTexture, colorSampler, in.texCoord);
            return out;
        }
    `;

    return { vertex, fragment };
}

export default generate;
