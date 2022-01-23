import fullscreenVert from './fullscreen.vert.wgsl.js';

export function generate({ input: { viewDimension = '2d', opaque = false } } = {}) {
    const vertex = fullscreenVert();

    const samplerTypes = {
        '2d'       : 'texture_2d',
        '2d-array' : 'texture_2d_array',
        'cube'     : 'texture_cube',
    }

    const resample = {
        '2d'       : /* wgsl */`textureSample(colorTexture, colorSampler, in.texCoord);`,
        '2d-array' : /* wgsl */`textureSample(colorTexture, colorSampler, vec3<f32>(in.texCoord, in.texLayer));`,
        'cube'     : /* wgsl */`textureSample(colorTexture, colorSampler, cubeCoord(in.texCoord * 2.0 - 1.0, in.texLayer))`,
    }

    const fragment = /* wgsl */`
        fn cubeCoord(uv: vec2<f32>, face: i32) -> vec3<f32> {
            if(face == 0) {
                return normalize(vec3<f32>(  1.0, -uv.y, -uv.x));
            } elseif(face == 1) {
                return normalize(vec3<f32>( -1.0, -uv.y,  uv.x));
            } elseif(face == 2) {
                return normalize(vec3<f32>( uv.x,   1.0,  uv.y));
            } elseif(face == 3) {
                return normalize(vec3<f32>( uv.x,  -1.0, -uv.y));
            } elseif(face == 4) {
                return normalize(vec3<f32>( uv.x, -uv.y,   1.0));
            } elseif(face == 5) {
                return normalize(vec3<f32>(-uv.x, -uv.y,  -1.0));
            }
            return vec3<f32>(0.0);
        }
        
        [[group(0), binding(0)]] var colorSampler: sampler;
        [[group(0), binding(1)]] var colorTexture: ${samplerTypes[viewDimension]}<f32>;
        
        struct VertexOutput {
            [[builtin(position)]] position: vec4<f32>;
            [[location(0)]] texCoord: vec2<f32>;
            [[location(1),interpolate(flat)]] texLayer: i32;
        };

        struct FragmentOutput {
            [[location(0)]] color: vec4<f32>;
        };

        [[stage(fragment)]]
        fn main(in: VertexOutput) -> FragmentOutput {
            var out: FragmentOutput;
            out.color = ${resample[viewDimension]};
            ${opaque ? /* wgsl */`out.color.a = 1.0;`: ''};
            return out;
        }
    `;
    
    return { vertex, fragment };
}

export default generate;