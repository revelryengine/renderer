import { Frustum     } from '../../../../frustum.js';
import { Environment } from '../../../../environment.js';

import fullscreenVert       from '../../../common/shaders/generators/fullscreen.vert.wgsl.js';

const frustumUniformBlock     = Frustum.generateUniformBlock('wgsl', 1, 0);
const environmentUniformBlock = Environment.generateUniformBlock('wgsl', 2, '$$binding');

/**
 * References:
 *
 * @see https://webglfundamentals.org/webgl/lessons/webgl-skybox.html
 */
export function generate({ locations, input: { settings } }) {
    const vertex = fullscreenVert();

    const { bindGroup } = locations;

    const settingsUniformBlock = settings.generateUniformBlock(0, 0);

    const fragment = /* wgsl */`
        ${settingsUniformBlock}
        ${frustumUniformBlock}
        ${environmentUniformBlock.replace('$$binding', bindGroup.environment)}

        @group(2) @binding(${bindGroup.envSampler}) var envSampler: sampler;
        @group(2) @binding(${bindGroup.envGGX})     var envGGX: texture_cube<f32>;

        struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) texCoord: vec2<f32>,
            @location(1) @interpolate(flat) texLayer: i32,
        };

        struct FragmentOutput {
            @location(0) color: vec4<f32>,
        };

        fn linearTosRGBA(color: vec4<f32>) -> vec4<f32> {
            return pow(color, vec4<f32>(1.0 / 2.2));
        }

        @fragment
        fn main(in: VertexOutput) -> FragmentOutput {
            var out: FragmentOutput;

            var coord = in.texCoord * 2.0 - 1.0;
            coord.y = -coord.y;

            var t = frustum.invViewProjectionMatrix * vec4<f32>(coord, 1.0, 1.0);

            var level = mix(0.0, f32(environment.mipLevelCount - 1), settings.skybox.blur);
            out.color = linearTosRGBA(textureSampleLevel(envGGX, envSampler, normalize(t.xyz / t.w), level));

            return out;
        }
    `;

    return { vertex, fragment };
}

export default generate;
