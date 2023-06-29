import fullscreenVert from './fullscreen.vert.wgsl.js';
import cubecoord      from './cubecoord.wgsl.js';

export function generate({ flags: { viewDimension = '2d', opaque = false, depth = false, multisampled = false } } = {}) {
    const vertex = fullscreenVert();

    const type = depth ? 'depth': viewDimension;

    const samplerTypes = {
        '2d'       : 'texture_2d<f32>',
        '2d-array' : 'texture_2d_array<f32>',
        'cube'     : 'texture_cube<f32>',
        'depth'    : `texture_depth${multisampled ? '_multisampled': ''}_2d`,
    }

    const resample = {
        '2d'       : /* wgsl */`textureSample(colorTexture, colorSampler, in.texCoord)`,
        '2d-array' : /* wgsl */`textureSample(colorTexture, colorSampler, vec3<f32>(in.texCoord, in.texLayer))`,
        'cube'     : /* wgsl */`textureSample(colorTexture, colorSampler, cubeCoord(in.texCoord * 2.0 - 1.0, in.texLayer))`,
        'depth'    : /* wgsl */`textureLoad(colorTexture, depthCoord(in.texCoord), in.texLayer)`,
    }

    const fragment = /* wgsl */`

        ${type === 'cube' ? cubecoord() : ''}
        
        @group(0) @binding(0) var colorSampler: sampler;
        @group(0) @binding(1) var colorTexture: ${samplerTypes[type]};
        
        struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) texCoord: vec2<f32>,
            @location(1) @interpolate(flat) texLayer: i32,
        };

        ${type === 'depth' ? /* wgsl */`
            struct FragmentOutput {
                @builtin(frag_depth) depth: f32,
            };

            fn depthCoord(uv: vec2<f32>) -> vec2<i32> {
                var size = vec2<f32>(textureDimensions(colorTexture));
                return vec2<i32>(floor(uv * size));
            }

            @fragment
            fn main(in: VertexOutput) -> FragmentOutput {
                var out: FragmentOutput;
                out.depth = ${resample[type]};
                return out;
            }
        `: /* wgsl */`
            struct FragmentOutput {
                @location(0) color: vec4<f32>,
            };

            @fragment
            fn main(in: VertexOutput) -> FragmentOutput {
                var out: FragmentOutput;
                out.color = ${resample[type]};
                ${opaque ? /* wgsl */`out.color.a = 1.0;`: ''};
                return out;
            }
        `} 
    `;
    
    return { vertex, fragment };
}

export default generate;