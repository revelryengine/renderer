import { Frustum  } from '../../../../frustum.js';

import fullscreenVert       from '../../../common/shaders/generators/fullscreen.vert.wgsl.js';

const frustumUniformBlock  = Frustum.generateUniformBlock('wgsl', 1, 0);

export function generate({ input: { mode = 'extract', settings } }) {
    const vertex = fullscreenVert();

    const settingsUniformBlock = settings.generateUniformBlock(0, 0);

    const modes = {
        extract: /* wgsl */`
            ${settingsUniformBlock}
            ${frustumUniformBlock}

            @group(2) @binding(0) var colorSampler: sampler;
            @group(2) @binding(1) var colorTexture: texture_2d<f32>;

            fn prefilter(c: vec4<f32>) -> vec4<f32> {
                var brightness = max(c.r, max(c.g, c.b));
                var soft = brightness - settings.bloom.knee.y;
                soft = clamp(soft, 0.0, settings.bloom.knee.z);
                soft = soft * soft * settings.bloom.knee.w;
                var contribution = max(soft, brightness - settings.bloom.knee.x);
                contribution = contribution / max(brightness, 0.00001);
                return c * contribution;
            }

            @fragment
            fn main(in: VertexOutput) -> FragmentOutput {
                var out: FragmentOutput;

                out.color = prefilter(textureSample(colorTexture, colorSampler, in.texCoord));

                return out;
            }
        `,
        mix: /* wgsl */`
            ${settingsUniformBlock}
            ${frustumUniformBlock}

            @group(2) @binding(0) var texSampler: sampler;
            @group(2) @binding(1) var colorTexture: texture_2d<f32>;
            @group(2) @binding(2) var bloomTexture: texture_2d<f32>;

            @fragment
            fn main(in: VertexOutput) -> FragmentOutput {
                var out: FragmentOutput;

                var color = textureSample(colorTexture, texSampler, in.texCoord);
                var bloom = textureSample(bloomTexture, texSampler, in.texCoord);
                out.color = color + bloom * settings.bloom.intensity;

                return out;
            }
        `,
    }

    const fragment = /* wgsl */`
        struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) texCoord: vec2<f32>,
            @location(1) @interpolate(flat) texLayer: i32,
        };

        struct FragmentOutput {
            @location(0) color: vec4<f32>,
        };

        ${modes[mode]}
    `;

    return { vertex, fragment };
}

export default generate;
