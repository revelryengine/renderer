import fullscreenVert from './fullscreen.vert.wgsl.js';

export function generate() {
    const vertex = fullscreenVert();

    const fragment = /* wgsl */`        
        @group(0) @binding(7) var gameObjectTexture: texture_2d_array<f32>;

        @group(1) @binding(0) var idSampler: sampler;
        @group(1) @binding(1) var idTexture: texture_2d<u32>;
        
        struct VertexOutput {
            @builtin(position) gl_FragCoord: vec4<f32>,
            @location(0) texCoord: vec2<f32>,
        };

        struct FragmentOutput {
            @location(0) color: vec4<f32>,
        };


        fn readInfo(tex: texture_2d_array<f32>, i: u32) -> vec4<f32>{
            var size = vec2<f32>(textureDimensions(tex));

            var index  = f32(i);

            var x = i32((index % size.x));
            var y = i32(floor(index / size.x) % size.y);
            var z = i32(floor(index / (size.x * size.y)));

            return textureLoad(tex, vec2<i32>(x, y), z, 0);
        }

        fn edge(center: u32, width: i32, texCoord: vec2<i32>) -> bool{            
            var t = textureLoad(idTexture, texCoord + vec2<i32>( 0,-1) * width, 0).r;
            var b = textureLoad(idTexture, texCoord + vec2<i32>( 0, 1) * width, 0).r;
            var l = textureLoad(idTexture, texCoord + vec2<i32>(-1, 0) * width, 0).r;
            var r = textureLoad(idTexture, texCoord + vec2<i32>( 1, 0) * width, 0).r;

            var tl = textureLoad(idTexture, texCoord + vec2<i32>(-1,-1) * width, 0).r;
            var tr = textureLoad(idTexture, texCoord + vec2<i32>( 1,-1) * width, 0).r;
            var bl = textureLoad(idTexture, texCoord + vec2<i32>(-1, 1) * width, 0).r;
            var br = textureLoad(idTexture, texCoord + vec2<i32>( 1, 1) * width, 0).r;

            var sum = f32(t != center) + f32(b != center) + f32(l != center) + f32(r != center) +
                        f32(tl != center) + f32(tr != center) + f32(bl != center) + f32(br != center);

            return sum > 0.0;
        }

        @fragment
        fn main(in: VertexOutput) -> FragmentOutput {
            var out: FragmentOutput;
            var id = textureLoad(idTexture, vec2<i32>(in.gl_FragCoord.xy), 0).r;
            if(!edge(id, 1, vec2<i32>(in.gl_FragCoord.xy))){
                discard;
            }
            out.color = readInfo(gameObjectTexture, id);
            return out;
        }
    `;
    
    return { vertex, fragment };
}

export default generate;