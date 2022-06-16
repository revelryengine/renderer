import fullscreenVert from './fullscreen.vert.wgsl.js';
import generateUniformBlock  from './uniform.wgsl.js';

/**
 * References:
 * 
 * @see https://github.com/spite/Wagner/blob/87dde4895e38ab8c2ef432b1e623ece9484ea5cc/fragment-shaders/poisson-disc-blur-fs.wgsl
 * @see http://developer.amd.com/wordpress/media/2012/10/GDC06-ATI_Session-Oat-ShaderTricks.pdf
 */
export function generate({ uniforms }) {
    const vertex = fullscreenVert();

    const NUM_TAPS = 12;

    const fragment = /* wgsl */`

        @group(2) @binding(0) var colorSampler: sampler;
        @group(2) @binding(1) var colorTexture: texture_2d<f32>;

        ${generateUniformBlock(uniforms.settings, 2, 2)}

        struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) texCoord: vec2<f32>,
            @location(1) @interpolate(flat) texLayer: i32,
        };
                
        struct FragmentOutput {
            @location(0) color: vec4<f32>,
        };

        fn nrand(n: vec2<f32>) -> f32 {
            return fract(sin(dot(n.xy, vec2<f32>(12.9898, 78.233))) * 43758.5453);
        }
        
        fn rot2d( p: vec2<f32>, a: f32 ) -> vec2<f32> {
            var sc = vec2<f32>(sin(a),cos(a));
            return vec2<f32>(dot( p, vec2<f32>(sc.y, -sc.x)), dot(p, sc.xy));
        }

        let taps = array<vec2<f32>, 12>(
            vec2<f32>(-0.326212,-0.40581 ),
            vec2<f32>(-0.840144,-0.07358 ),
            vec2<f32>(-0.695914, 0.457137),
            vec2<f32>(-0.203345, 0.620716),
            vec2<f32>( 0.96234 ,-0.194983),
            vec2<f32>( 0.473434,-0.480026),
            vec2<f32>( 0.519456, 0.767022),
            vec2<f32>( 0.185461,-0.893124),
            vec2<f32>( 0.507431, 0.064425),
            vec2<f32>( 0.89642 , 0.412458),
            vec2<f32>(-0.32194 ,-0.932615),
            vec2<f32>(-0.791559,-0.59771 )
        );
            

        @stage(fragment)
        fn main(in: VertexOutput) -> FragmentOutput {
            var out: FragmentOutput;

            var texelSize = 1.0 / vec2<f32>(textureDimensions(colorTexture, 0));
            
            var sum = textureSample(colorTexture, colorSampler, in.texCoord);

            var rnd  = 6.28 * nrand(in.texCoord);
            var basis = vec4<f32>(rot2d(vec2<f32>(1.0, 0.0), rnd), rot2d(vec2<f32>(0.0, 1.0), rnd));

            for (var i = 0; i < ${NUM_TAPS}; i++) {
                var offset = taps[i]; 
                offset = vec2<f32>(dot(offset, basis.xz), dot(offset, basis.yw));
                var coord = in.texCoord + poissonsettings.radius * offset * texelSize;
                sum = sum + textureSample(colorTexture, colorSampler, coord);
            }

            out.color = sum / f32(${NUM_TAPS + 1});
            return out;
        }
    `;

    return { vertex, fragment };
}

export default generate;