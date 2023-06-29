import fullscreenVert from './fullscreen.vert.wgsl.js';

/**
 * References:
 * 
 * @see https://www.elopezr.com/temporal-aa-and-the-quest-for-the-holy-trail/
 * @see https://alextardif.com/TAA.html
 * @see https://sugulee.wordpress.com/2021/06/21/temporal-anti-aliasingtaa-tutorial/
 */

export function generate() {
    const vertex = fullscreenVert();

    const fragment = /* wgsl */`
        @group(2) @binding(0) var colorSampler: sampler;
        @group(2) @binding(1) var colorTexture: texture_2d<f32>;
        @group(2) @binding(2) var motionSampler: sampler;
        @group(2) @binding(3) var motionTexture: texture_2d<f32>;
        @group(2) @binding(4) var historySampler: sampler;
        @group(2) @binding(5) var historyTexture: texture_2d<f32>;

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

            var velocity = textureSample(motionTexture, motionSampler, in.texCoord).xy;
            var historyCoord = in.texCoord - velocity;

            var currentColor = textureSample(colorTexture, colorSampler, in.texCoord);
            var historyColor = textureSample(historyTexture, historySampler, historyCoord);
            
            // Apply clamping on the history color.
            var nearColor0 = textureSample(colorTexture, colorSampler, in.texCoord, vec2<i32>(1, 0));
            var nearColor1 = textureSample(colorTexture, colorSampler, in.texCoord, vec2<i32>(0, 1));
            var nearColor2 = textureSample(colorTexture, colorSampler, in.texCoord, vec2<i32>(-1, 0));
            var nearColor3 = textureSample(colorTexture, colorSampler, in.texCoord, vec2<i32>(0, -1));
            
            var boxMin = min(currentColor, min(nearColor0, min(nearColor1, min(nearColor2, nearColor3))));
            var boxMax = max(currentColor, max(nearColor0, max(nearColor1, max(nearColor2, nearColor3))));;
            
            historyColor = clamp(historyColor, boxMin, boxMax);
            
            var modulationFactor = 0.9;
            
            out.color = mix(currentColor, historyColor, modulationFactor);

            return out;
        }
    `;
    
    return { vertex, fragment };
}

export default generate;