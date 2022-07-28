import { Settings } from '../../settings.js';
import { Frustum  } from '../../frustum.js';

import generateUniformBlock  from './uniform.wgsl.js';

import fullscreenVert from './fullscreen.vert.wgsl.js';

const settingsUniformBlock = generateUniformBlock(Settings, 0, 0);
const frustumUniformBlock  = generateUniformBlock(Frustum, 1, 0);

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

        ${settingsUniformBlock}
        ${frustumUniformBlock}
        
        @stage(fragment)
        fn main(in: VertexOutput) -> FragmentOutput {
            var out: FragmentOutput;

            out.color = vec4<f32>(in.texCoord.x + frustum.position.x, in.texCoord.y + frustum.position.y, settings.ssao.radius, 1.0);

            return out;
        }
    `;
    
    return { vertex, fragment };
}

export default generate;