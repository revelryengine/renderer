import fullscreenVert from './fullscreen.vert.wgsl.js';

/**
 * References:
 * 
 * @see https://dipaola.org/art/wp-content/uploads/2017/09/cgf2012.pdf
 * @see http://tuxedolabs.blogspot.com/2018/05/bokeh-depth-of-field-in-single-pass.html?m=1
 */

export function generate() {
    const vertex = fullscreenVert();

    const fragment = /* wgsl */`

        @group(0) @binding(0) var texSampler: sampler;
        @group(0) @binding(1) var colorTexture: texture_2d<f32>;
        @group(0) @binding(2) var cocTexture: texture_2d<f32>;


        struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) texCoord: vec2<f32>,
            @location(1) @interpolate(flat) texLayer: i32,
        };

        struct FragmentOutput {
            @location(0) color: vec4<f32>,
        };

        let GOLDEN_ANGLE  = 2.39996323;
        let MAX_BLUR_SIZE = 20.0;
        let RAD_SCALE     = 1.0; // Smaller = nicer blur, larger = faster

        fn depthOfField(texCoord: vec2<f32>) -> vec4<f32> {
            var texelSize = 1.0 / vec2<f32>(textureDimensions(colorTexture, 0));

            var centerCoC   = textureSample(cocTexture, texSampler, texCoord).rg;
            var centerSize  = abs(centerCoC.r) * MAX_BLUR_SIZE;
            var centerDepth = centerCoC.g;
            
            var color = textureSample(colorTexture, texSampler, texCoord);

            var tot = 1.0;

            var radius = RAD_SCALE;
            for (var ang = 0.0; radius < MAX_BLUR_SIZE; ang = ang + GOLDEN_ANGLE) {

                var tc = texCoord + vec2<f32>(cos(ang), sin(ang)) * texelSize * radius;

                var sampleColor = textureSample(colorTexture, texSampler, tc);
                var sampleCoC   = textureSample(cocTexture, texSampler, texCoord).rg;
                var sampleSize  = abs(sampleCoC.r) * MAX_BLUR_SIZE;
                var sampleDepth = sampleCoC.g;

                if (sampleDepth > centerDepth + 0.05){
                    sampleSize = clamp(sampleSize, 0.0, centerSize * 2.0);
                }

                var m = smoothstep(radius - 0.5, radius + 0.5, sampleSize);
                color = color + mix(color/tot, sampleColor, m);
                tot = tot + 1.0;
                radius = radius + RAD_SCALE / radius;
            }
            return color / tot;
        }
        
        @stage(fragment)
        fn main(in: VertexOutput) -> FragmentOutput {
            var out: FragmentOutput;

            out.color = depthOfField(in.texCoord);

            return out;
        }
    `;
    
    return { vertex, fragment };
}

export default generate;