import { frustum } from './frustum.glsl.js';

/**
 * This is a shader to render a reference grid
 * 
 * Should be used with grid.vert.js vertex shader.
 */
 const glsl = String.raw; // For syntax-highlighting
export const fragmentShader = glsl`
/********** grid.frag.js **********/
precision highp float;

${frustum}

uniform vec4 u_ColorThick;
uniform vec4 u_ColorThin;

in vec3 v_WorldPosition;

const float min_pixels_between_cells = 1.0;

uniform float u_Increment;
uniform float u_Extent;

layout(location = 0) out vec4 g_finalColor;

float saturate(float value) {
    return clamp(value, 0.0, 1.0);
}

vec2 saturate(vec2 value) {
    return clamp(value, vec2(0.0), vec2(1.0));
}

float log10(float value) {
    return log(value)/log(10.0);
}

void main(void) {
    vec3 fragPos = v_WorldPosition;
    
    vec2 uv = fragPos.xz;
    vec2 dudv = fwidth(uv);

    float cs = u_Increment;
    
    float lod_level = max(0.0, log10((length(dudv) * min_pixels_between_cells) / cs) + 1.0);
    float lod_fade  = fract(lod_level);

    float lod0_cs = cs * pow(10.0, floor(lod_level));
    float lod1_cs = lod0_cs * 10.0;
    float lod2_cs = lod1_cs * 10.0;

    dudv *= 2.0;

    vec2 center = uv + dudv / 2.0;

    vec2 lod0_cross_a = 1.0 - abs(saturate(mod(center, lod0_cs) / dudv) * 2.0 - 1.0);
    float lod0_a = max(lod0_cross_a.x, lod0_cross_a.y);

    vec2 lod1_cross_a = 1.0 - abs(saturate(mod(center, lod1_cs) / dudv) * 2.0 - 1.0);
    float lod1_a = max(lod1_cross_a.x, lod1_cross_a.y);
    
    vec2 lod2_cross_a = 1.0 - abs(saturate(mod(center, lod2_cs) / dudv) * 2.0 - 1.0);
    float lod2_a = max(lod2_cross_a.x, lod2_cross_a.y);

    vec4 c = lod2_a > 0.0 ? u_ColorThick : lod1_a > 0.0 ? mix(u_ColorThick, u_ColorThin, lod_fade) : u_ColorThin;

    float op_distance = (1.0 - saturate(length(uv - u_FrustumPosition.xz) / u_Extent));
    float op = op_distance;

    c.a *= (lod2_a > 0.0 ? lod2_a : lod1_a > 0.0 ? lod1_a : (lod0_a * (1.0 - lod_fade))) * op;

    g_finalColor = c;
}
/********** /grid.frag.js **********/
`;

export default fragmentShader;
