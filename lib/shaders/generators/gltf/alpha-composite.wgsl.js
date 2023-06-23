import fullscreenVert from '../fullscreen.vert.wgsl.js';
/** 
 * @see https://learnopengl.com/Guest-Articles/2020/OIT/Weighted-Blended
 */

export function generate() {
    const vertex = fullscreenVert();

    const fragment = /* wgsl */`

        @group(0) @binding(0) var texSampler:    sampler;
        @group(0) @binding(1) var accumTexture:  texture_2d<f32>;
        @group(0) @binding(2) var revealTexture: texture_2d<f32>;

        struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) texCoord: vec2<f32>,
            @location(1) @interpolate(flat) texLayer: i32,
        };

        struct FragmentOutput {
            @location(0) color: vec4<f32>,
        };

        // epsilon number
        const EPSILON = 0.00001;

        // calculate floating point numbers equality accurately
        fn isApproximatelyEqual(a: f32, b: f32) -> bool {
            return abs(a - b) <= EPSILON;
        }

        // get the max value between three values
        // fn max3(v: vec3<f32>) -> f32 {
        //     return max(max(v.x, v.y), v.z);
        // }

        @fragment
        fn main(in: VertexOutput) -> FragmentOutput {
            var out: FragmentOutput;

            var revealage = textureSample(revealTexture, texSampler, in.texCoord).r;

            // save the blending and color texture fetch cost if there is not a transparent fragment
            if (isApproximatelyEqual(revealage, 1.0)){
                discard;
            }

            // fragment color
            var accumulation = textureSample(accumTexture, texSampler, in.texCoord);

            // suppress overflow
            // if (isinf(max3(abs(accumulation.rgb)))){ //there is no isinf in wgsl
            //     accumulation.rgb = vec3(accumulation.a);
            // }

            // prevent floating point precision bug
            var average_color = accumulation.rgb / max(accumulation.a, EPSILON);
            
            out.color = vec4<f32>(average_color, 1.0 - revealage);

            return out;
        }
    `;
    
    return { vertex, fragment };
}

export default generate;