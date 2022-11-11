
import { Settings } from '../../settings.js';

import fullscreenVert        from './fullscreen.vert.wgsl.js';
import generateUniformBlock  from './uniform.wgsl.js';

const settingsUniformBlock = generateUniformBlock(Settings, 0, 0);

/**
 * References:
 * 
 * @see https://lettier.github.io/3d-game-shaders-for-beginners/motion-blur.html
 * @see https://ogldev.org/www/tutorial41/tutorial41.html
 * @see https://developer.nvidia.com/gpugems/gpugems3/part-iv-image-effects/chapter-27-motion-blur-post-processing-effect
 */

export function generate() {
    const vertex = fullscreenVert();

    const fragment = /* wgsl */`
        
        ${settingsUniformBlock}

        @group(2) @binding(0) var colorSampler: sampler;
        @group(2) @binding(1) var colorTexture: texture_2d<f32>;
        @group(2) @binding(2) var motionSampler: sampler;
        @group(2) @binding(3) var motionTexture: texture_2d<f32>;


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

            var motion = (textureSample(motionTexture, motionSampler, in.texCoord).xy * settings.motionBlur.scale) / 2.0;

            var color = vec4<f32>(0.0);
            var coord = in.texCoord;

            color += textureSample(colorTexture, colorSampler, coord) * 0.4;
            coord -= motion;
            color += textureSample(colorTexture, colorSampler, coord) * 0.3;
            coord -= motion;
            color += textureSample(colorTexture, colorSampler, coord) * 0.2;
            coord -= motion;
            color += textureSample(colorTexture, colorSampler, coord) * 0.1;
            
            out.color = color;

            return out;
        }
    `;
    
    return { vertex, fragment };
}

export default generate;