import fullscreenVert       from '../../../common/shaders/generators/fullscreen.vert.wgsl.js';
import generateUniformBlock from '../../../common/shaders/generators/uniform.wgsl.js';

import { Frustum  } from '../../../../frustum.js';
import { Settings } from '../../settings.js';

const settingsUniformBlock = generateUniformBlock(Settings, 0, 0);
const frustumUniformBlock  = generateUniformBlock(Frustum, 1, 0);

/**
 * References:
 * 
 * @see https://learnopengl.com/Advanced-Lighting/SSAO
 * @see https://mynameismjp.wordpress.com/2010/09/05/position-from-depth-3/
 * @see https://www.derschmale.com/2014/01/26/reconstructing-positions-from-the-depth-buffer/
 * @see https://www.khronos.org/opengl/wiki/Compute_eye_space_from_window_space
 */

export function generate({ input: { buffer, size } }) {
    const vertex = fullscreenVert();

    const fragment = /* wgsl */`

        ${settingsUniformBlock}
        ${frustumUniformBlock}

        struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) texCoord: vec2<f32>,
            @location(1) @interpolate(flat) texLayer: i32,
        };
                
        struct FragmentOutput {
            @location(0) color: vec4<f32>,
        };
        
        @group(2) @binding(0) var pointSampler: sampler;
        @group(2) @binding(1) var pointTexture: texture_2d<f32>;
        @group(2) @binding(2) var noiseSampler: sampler;
        @group(2) @binding(3) var noiseTexture: texture_2d<f32>;

        ${generateUniformBlock(buffer, 2, 4)}

        const noiseScale = vec2<f32>(${size.width.toFixed(1)}, -${size.height.toFixed(1)});

        fn getPosFromDepth(coord: vec2<f32>, depth: f32) -> vec3<f32> {
            var flipped = vec2<f32>(coord.x, 1.0 - coord.y); //flip y for webgpu coordinate system
            var clip = frustum.invProjectionMatrix * vec4<f32>(vec3<f32>(flipped, depth) * 2.0 - 1.0, 1.0);
            return clip.xyz / clip.w;
        }

        fn getOffsetDepth(coord: vec2<f32>) -> f32 {
            var flipped = vec2<f32>(coord.x, 1.0 - coord.y); //flip y for webgpu coordinates system
            var depth = textureSample(pointTexture, pointSampler, flipped).x;
            return getPosFromDepth(flipped, depth).z;
        }

        @fragment
        fn main(in: VertexOutput) -> FragmentOutput {
            var out: FragmentOutput;

            var pointInfo = textureSample(pointTexture, pointSampler, in.texCoord);
            var fragPos   = getPosFromDepth(in.texCoord, pointInfo.x);
            var normal    = pointInfo.yzw;
            var randomVec = textureSample(noiseTexture, noiseSampler, in.texCoord * noiseScale).xyz;
            var tangent   = normalize(randomVec - normal * dot(randomVec, normal));
            var bitangent = cross(normal, tangent);
            var TBN       = mat3x3<f32>(tangent, bitangent, normal);
            var occlusion = 0.0;

            for(var i = 0; i < ${buffer.kernel.length}; i++) {
                // get sample position
                var samplePos = TBN * ssaouniform.kernel[i]; // from tangent to view-space
                samplePos = fragPos + samplePos * settings.ssao.radius; 
                
                var offset = vec4<f32>(samplePos, 1.0);
                offset = frustum.projectionMatrix * offset;    // from view to clip-space
                
                var sampleDepth = getOffsetDepth((offset.xy / offset.w) * 0.5 + 0.5); //perspective divide and transform to range 0.0 - 1.0  
                var rangeCheck  = smoothstep(0.0, 1.0, settings.ssao.radius / abs(fragPos.z - sampleDepth));
                occlusion = occlusion + (select(0.0, 1.0, sampleDepth >= samplePos.z + settings.ssao.bias) * rangeCheck);      
            }  
            occlusion = 1.0 - (occlusion / ${buffer.kernel.length.toFixed(1)});

            out.color = vec4<f32>(vec3<f32>(occlusion), 1.0);

            return out;
        }
    `;
    
    return { vertex, fragment };
}

export default generate;