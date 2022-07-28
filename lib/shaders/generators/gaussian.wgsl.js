import fullscreenVert from './fullscreen.vert.wgsl.js';

/**
 * References:
 * 
 * @see https://stackoverflow.com/questions/6538310/anyone-know-where-i-can-find-a-glsl-implementation-of-a-bilateral-filter-blur/6538650
 * @see https://www.gamasutra.com/blogs/PeterWester/20140116/208742/Generating_smooth_and_cheap_SSAO_using_Temporal_Blur.php
 * @see https://github.com/mattdesl/lwjgl-basics/wiki/ShaderLesson5
 * @see https://rastergrid.com/blog/2010/09/efficient-gaussian-blur-with-linear-sampling/
 */

/**
 * Pascals Triangle Rows 8, 12, and 16, with 2 outermost coefficents dropped
 * 28 56 70 56 28                                                     238
 * 66 220 495 792 924 792 495 220 66                                  4070
 * 120 560 1820 4368 8008 11440 12870 11440 8008 4368 1820 560 120    65502
 */


export function generate({ flags: { horizontal, bilateral } }) {
    const vertex = fullscreenVert();

    const fragment = /* wgsl */`        
        @group(0) @binding(0) var colorSampler: sampler;
        @group(0) @binding(1) var colorTexture: texture_2d<f32>;

        struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) texCoord: vec2<f32>,
            @location(1) @interpolate(flat) texLayer: i32,
        };
                
        struct FragmentOutput {
            @location(0) color: vec4<f32>,
        };

        let sampleCount   = 3;
        let colorSamples  = array<f32, 3>(0.0, 1.3846153846, 3.2307692308);
        let gaussianCoeff = array<f32, 3>(0.2270270270, 0.3162162162, 0.0702702703);

        @stage(fragment)
        fn main(in: VertexOutput) -> FragmentOutput {
            var out: FragmentOutput;

            var texelSize = 1.0 / vec2<f32>(textureDimensions(colorTexture, 0));

            ${horizontal ? /* wgsl */`
                var offsetScale = vec2<f32>(1.0, 0.0) * texelSize;
            `: /* wgsl */`
                var offsetScale = vec2<f32>(0.0, 1.0) * texelSize;
            `}

            ${bilateral ? /* wgsl */`
                /** 
                 * I have no idea if this is right but it does look slightly better. 
                 * The closeness function is currently base on color distance at the moment. 
                 * This is because I am trying to make SSAO tighter after the blur and reduce halo artifacts.
                 */
                var centerColor = textureSample(colorTexture, colorSampler, in.texCoord);
                var result = centerColor * 2.0 * gaussianCoeff[0];
                var normalization = 2.0 * gaussianCoeff[0];
                for (var i = 1; i < sampleCount; i++) {
                    var offset = colorSamples[i] * offsetScale;
                    var a = textureSample(colorTexture, colorSampler, in.texCoord + offset);
                    var b = textureSample(colorTexture, colorSampler, in.texCoord - offset);
                    var aCloseness = 1.0 - distance(a, centerColor) / length(vec4<f32>(1.0));
                    var bCloseness = 1.0 - distance(b, centerColor) / length(vec4<f32>(1.0));
                    var aWeight = gaussianCoeff[i] * aCloseness;
                    var bWeight = gaussianCoeff[i] * bCloseness;
                    result = result + (a * aWeight);
                    result = result + (b * bWeight);
                    normalization = normalization + (aWeight + bWeight);
                }
                out.color = result / normalization;
            `: /* wgsl */`
                out.color = textureSample(colorTexture, colorSampler, in.texCoord) * gaussianCoeff[0];
                for (var i = 1; i < sampleCount; i++) {
                    var offset = offsetScale * colorSamples[i];
                    out.color = out.color + textureSample(colorTexture, colorSampler, in.texCoord + offset) * gaussianCoeff[i];
                    out.color = out.color + textureSample(colorTexture, colorSampler, in.texCoord - offset) * gaussianCoeff[i];
                    
                }
            `}

            return out;
        }
    `;

    return { vertex, fragment };
}

export default generate;