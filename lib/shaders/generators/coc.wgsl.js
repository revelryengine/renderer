import { Settings } from '../../settings.js';
import { Frustum  } from '../../frustum.js';

import generateUniformBlock  from './uniform.wgsl.js';

const settingsUniformBlock = generateUniformBlock(Settings, 0, 0);
const frustumUniformBlock  = generateUniformBlock(Frustum, 1, 0);

export function generate() {
    const vertex = /* wgsl */`
    ${settingsUniformBlock}
    ${frustumUniformBlock}

    struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) texCoord: vec2<f32>,
        @location(1) cocPrecalc: f32,
    };

    @vertex
    fn main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
        var vertexID = i32(VertexIndex);
        var id = vertexID % 3;
        var x  = f32(u32(id & 1) << 2u);
        var y  = f32(u32(id & 2) << 1u);

        var out : VertexOutput;
        out.texCoord = vec2<f32>(x * 0.5, y * 0.5);
        
        var aperture = settings.lens.size / settings.lens.fStop;
        out.cocPrecalc = (aperture * settings.lens.focalLength) / (settings.lens.focalDistance - settings.lens.focalLength);

        out.position = vec4<f32>(x - 1.0, 1.0 - y, 0.0, 1.0);
        
        return out;
    }
`;

    const fragment = /* wgsl */`
        ${settingsUniformBlock}
        ${frustumUniformBlock}
        
        struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) texCoord: vec2<f32>,
            @location(1) cocPrecalc: f32,
        };
                
        struct FragmentOutput {
            @location(0) color: vec4<f32>,
        };
        
        fn getLinearDepth(d: f32) -> f32 {
            return frustum.near * frustum.far / (frustum.far + d * (frustum.near - frustum.far));
        }

        @group(2) @binding(0) var depthSampler: sampler;
        @group(2) @binding(1) var depthTexture: texture_depth_2d;
        
        @fragment
        fn main(in: VertexOutput) -> FragmentOutput {
            var out: FragmentOutput;

            var dist = getLinearDepth(textureSample(depthTexture, depthSampler, in.texCoord));
            var coc = abs(in.cocPrecalc * (((settings.lens.focalDistance / 1000.0) - dist) / dist));
            coc = clamp(coc, 0.0, 1.0);

            out.color = vec4<f32>(coc, dist, coc, 1.0);

            return out;
        }
    `;
    
    return { vertex, fragment };
}

export default generate;