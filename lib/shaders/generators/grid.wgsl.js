import { Settings } from '../../settings.js';
import { Frustum  } from '../../frustum.js';

import generateUniformBlock  from './uniform.wgsl.js';

const settingsUniformBlock = generateUniformBlock(Settings, 0, 0);
const frustumUniformBlock  = generateUniformBlock(Frustum, 1, 0);

export function generate() {
    const vertex = /* wgsl */`
        ${settingsUniformBlock}
        ${frustumUniformBlock}
        
        struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) worldPosition: vec3<f32>,
            @location(1) @interpolate(flat) reflection: f32,
        };

        var<private> gridPlane: array<vec3<f32>, 6> = array<vec3<f32>, 6>(
            vec3<f32>( 1.0, 0.0, 1.0), vec3<f32>(-1.0, 0.0,-1.0), vec3<f32>(-1.0, 0.0, 1.0),
            vec3<f32>(-1.0, 0.0,-1.0), vec3<f32>( 1.0, 0.0, 1.0), vec3<f32>( 1.0, 0.0,-1.0)
        );
        
        @vertex
        fn main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
            var out: VertexOutput;

            var forward  = frustum.invViewMatrix[2].xyz;
            var normal   = frustum.gridModelMatrix * vec4<f32>(0.0, 1.0, 0.0, 1.0);

            out.reflection    = smoothstep(0.0, 0.05, abs(dot(normalize(normal.xyz / normal.w), forward)));
            out.worldPosition = (gridPlane[i32(VertexIndex)] * frustum.far);
            
            out.position = frustum.gridViewProjectionMatrix * (frustum.gridModelMatrix * vec4<f32>(out.worldPosition, 1.0));
            return out;
        }
    `;

    const fragment = /* wgsl */`
        ${settingsUniformBlock}
        ${frustumUniformBlock}
        
        struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) worldPosition: vec3<f32>,
            @location(1) @interpolate(flat) reflection: f32,
        };
        
        const min_pixels_between_cells = 1.0;
        
        struct FragmentOutput {
            @location(0) color: vec4<f32>,
        };
        
        fn log10(value: f32) -> f32 {
            return log(value)/log(10.0);
        }

        fn mod2(x: vec2<f32>, y: f32) -> vec2<f32> {
            return x - y * floor(x / y);
        }
        
        @fragment
        fn main(in: VertexOutput) -> FragmentOutput {
            var out: FragmentOutput;

            var fragPos = in.worldPosition;
            
            var uv = fragPos.xz;
            var dudv = fwidth(uv);
        
            var cs = settings.grid.increment;
            
            var lod_level = max(0.0, log10((length(dudv) * min_pixels_between_cells) / cs) + 1.0);
            var lod_fade  = fract(lod_level);
        
            var lod0_cs = cs * pow(10.0, floor(lod_level));
            var lod1_cs = lod0_cs * 10.0;
            var lod2_cs = lod1_cs * 10.0;
        
            dudv = dudv * 2.0;
        
            var center = uv + dudv / 2.0;
        
            var lod0_cross_a = 1.0 - abs(saturate(mod2(center, lod0_cs) / dudv) * 2.0 - 1.0);
            var lod0_a = max(lod0_cross_a.x, lod0_cross_a.y);
        
            var lod1_cross_a = 1.0 - abs(saturate(mod2(center, lod1_cs) / dudv) * 2.0 - 1.0);
            var lod1_a = max(lod1_cross_a.x, lod1_cross_a.y);
            
            var lod2_cross_a = 1.0 - abs(saturate(mod2(center, lod2_cs) / dudv) * 2.0 - 1.0);
            var lod2_a = max(lod2_cross_a.x, lod2_cross_a.y);
        
            // var c = lod2_a > 0.0 ? settings.grid.colors.thick : lod1_a > 0.0 ? mix(settings.grid.colors.thick, settings.grid.colors.thin, lod_fade) : settings.grid.colors.thin;
            var c = select(select(settings.grid.colors.thin, mix(settings.grid.colors.thick, settings.grid.colors.thin, lod_fade), lod1_a > 0.0), settings.grid.colors.thick, lod2_a > 0.0);
        
            var op_distance = (1.0 - saturate(length(uv - frustum.position.xz) / (frustum.far / 2.0)));
            var op = op_distance;
        
            // c.a = c.a * (lod2_a > 0.0 ? lod2_a : lod1_a > 0.0 ? lod1_a : (lod0_a * (1.0 - lod_fade))) * op;
            c.a = c.a * select(select((lod0_a * (1.0 - lod_fade)), lod1_a, lod1_a > 0.0), lod2_a, lod2_a > 0.0) * op * in.reflection;
            out.color = c;

            //out.color = vec4<f32>(fragPos, 1.0);

            return out;
        }
    `;
    
    return { vertex, fragment };
}

export default generate;