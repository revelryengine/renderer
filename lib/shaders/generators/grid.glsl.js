import { Settings } from '../../settings.js';
import { Frustum  } from '../../frustum.js';

import generateUniformBlock  from './uniform.glsl.js';

const settingsUniformBlock = generateUniformBlock(Settings, 0, 0);
const frustumUniformBlock  = generateUniformBlock(Frustum, 1, 0);

export function generate() {
    const vertex = /* glsl */`#version 300 es
        precision highp float;

        ${settingsUniformBlock}
        ${frustumUniformBlock}
        
        out vec3 v_worldPosition;
        
        vec3 gridPlane[6] = vec3[](
            vec3( 1.0, 0.0, 1.0), vec3(-1.0, 0.0,-1.0), vec3(-1.0, 0.0, 1.0),
            vec3(-1.0, 0.0,-1.0), vec3( 1.0, 0.0, 1.0), vec3( 1.0, 0.0,-1.0)
        );
        
        void main(void) {
            vec3 pos = gridPlane[gl_VertexID] * (frustum.far / 2.0);
            pos.x = pos.x + frustum.position.x;
            pos.z = pos.z + frustum.position.z;
            v_worldPosition = pos;
            gl_Position = frustum.viewProjectionMatrix * vec4(pos, 1.0);
        }
    `;

    const fragment = /* glsl */`#version 300 es
        precision highp float;

        ${settingsUniformBlock}
        ${frustumUniformBlock}
        
        in vec3 v_worldPosition;
        
        const float min_pixels_between_cells = 1.0;
        
        layout(location = 0) out vec4 g_finalColor;
        
        float saturate(float value) {
            return clamp(value, 0.0, 1.0);
        }
        
        vec2 saturateVec2(vec2 value) {
            return clamp(value, vec2(0.0), vec2(1.0));
        }
        
        float log10(float value) {
            return log(value)/log(10.0);
        }
        
        void main(void) {
            vec3 fragPos = v_worldPosition;
            
            vec2 uv = fragPos.xz;
            vec2 dudv = fwidth(uv);
        
            float cs = settings.grid.increment;
            
            float lod_level = max(0.0, log10((length(dudv) * min_pixels_between_cells) / cs) + 1.0);
            float lod_fade  = fract(lod_level);
        
            float lod0_cs = cs * pow(10.0, floor(lod_level));
            float lod1_cs = lod0_cs * 10.0;
            float lod2_cs = lod1_cs * 10.0;
        
            dudv = dudv * 2.0;
        
            vec2 center = uv + dudv / 2.0;
        
            vec2 lod0_cross_a = 1.0 - abs(saturateVec2(mod(center, lod0_cs) / dudv) * 2.0 - 1.0);
            float lod0_a = max(lod0_cross_a.x, lod0_cross_a.y);
        
            vec2 lod1_cross_a = 1.0 - abs(saturateVec2(mod(center, lod1_cs) / dudv) * 2.0 - 1.0);
            float lod1_a = max(lod1_cross_a.x, lod1_cross_a.y);
            
            vec2 lod2_cross_a = 1.0 - abs(saturateVec2(mod(center, lod2_cs) / dudv) * 2.0 - 1.0);
            float lod2_a = max(lod2_cross_a.x, lod2_cross_a.y);
        
            vec4 c = lod2_a > 0.0 ? settings.grid.colors.thick : lod1_a > 0.0 ? mix(settings.grid.colors.thick, settings.grid.colors.thin, lod_fade) : settings.grid.colors.thin;
        
            float op_distance = (1.0 - saturate(length(uv - frustum.position.xz) / (frustum.far / 2.0)));
            float op = op_distance;
        
            c.a = c.a * (lod2_a > 0.0 ? lod2_a : lod1_a > 0.0 ? lod1_a : (lod0_a * (1.0 - lod_fade))) * op;
        
            g_finalColor = c;
        }
    `;
    
    return { vertex, fragment };
}

export default generate;