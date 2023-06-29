import { Frustum } from '../../../../../frustum.js';

import generateUniformBlock  from '../../../../common/shaders/generators/uniform.wgsl.js';
import generateVertexBlock   from '../../../../standard/shaders/generators/gltf/vertex.wgsl.js';

import { Settings } from '../../../settings.js';

const settingsUniformBlock = generateUniformBlock(Settings, 0, 0);
const frustumUniformBlock  = generateUniformBlock(Frustum,  1, 0);

export function generate({ flags, locations }) {  

    const vertex = generateVertexBlock({ flags, locations });
    
    const fragment = /* wgsl */`
        ${settingsUniformBlock}
        ${frustumUniformBlock}

        struct FragmentInput {
            @builtin(position) gl_FragCoord: vec4<f32>,
            @location(0) position: vec3<f32>,

            @location(1) texCoord: vec4<f32>,

            ${flags.colorTargets.motion ? /* wgsl */`
            @location(13) motionPosition: vec4<f32>,
            @location(14) motionPositionPrev: vec4<f32>,
            ` : ''}

            @location(15) barycentric: vec3<f32>,

            @builtin(front_facing) frontFacing: bool,
        };

        var<private> in: FragmentInput;

        struct FragmentOutput {
            @location(0) color: vec4<f32>,
            @location(5) motionVector: vec2<f32>,
        };

        fn edgeFactor(vbc: vec3<f32>) -> f32 {
            var d = fwidth(vbc);
            var f = step(d * settings.wireframe.width, vbc);
            return 1.0 - min(min(f.x, f.y), f.z);
        }
        
        @fragment
        fn main(input: FragmentInput) -> FragmentOutput {
            in = input;

            var out: FragmentOutput;

            ${flags.colorTargets.motion ? /* wgsl */`
                var a = (in.motionPosition.xy / in.motionPosition.w) * 0.5 + 0.5;
                var b = (in.motionPositionPrev.xy / in.motionPositionPrev.w) * 0.5 + 0.5;
                out.motionVector = a - b;
            `: ''}

            ${flags.colorTargets.color ? /* wgsl */`
                out.color = settings.wireframe.color;

                if(edgeFactor(in.barycentric) < 1.0) {
                    discard;
                }

                out.color.a *= (1.0 - f32(!in.frontFacing) * 0.25);

            `: ''}

            return out;
        }
    `;

    return { vertex, fragment };
}

export default generate;