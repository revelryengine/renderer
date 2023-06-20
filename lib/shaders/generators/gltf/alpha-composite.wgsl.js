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

            var accum = textureSample(accumTexture, texSampler, in.texCoord);
            var r = 1.0 - accum.a; // I don't know if there is a bug here or not but WebGPU seems to treat the blend factor differently than WebGL2 so we have to invert this.

            // save the blending and color texture fetch cost if there is not a transparent fragment
            if (isApproximatelyEqual(r, 0.0)){
                discard;
            }

            accum.a = textureSample(revealTexture, texSampler, in.texCoord).r;

            // suppress overflow
            // if (isinf(max3(abs(accum.rgb)))) {
            //     accum = vec4<f32>(vec3<f32>(accum.a), accum.a);
            // }

            var average_color = accum.rgb / max(accum.a, EPSILON);
            
            out.color = vec4<f32>(average_color, r);

            return out;
        }
    `;
    
    return { vertex, fragment };
}

export default generate;