import { PBR_DEBUG_MODES } from '../../../../../constants.js';
import { Frustum         } from '../../../../../frustum.js';

import generateUniformBlock  from '../../../../common/shaders/generators/uniform.glsl.js';

import { Settings } from '../../../settings.js';

import generateFormulasBlock from '../formulas.glsl.js';

import generateVertexBlock   from './vertex.glsl.js';
import generateLightingBlock from './lighting.glsl.js';
import generateMaterialBlock from './material.glsl.js';

const formulasBlock        = generateFormulasBlock();
const settingsUniformBlock = generateUniformBlock(Settings, 0, 0);
const frustumUniformBlock  = generateUniformBlock(Frustum, 1, 0);

export function generate({ flags, locations }) {
    const color0Type   = flags.hasColor0Vec4   ? 'vec4': 'vec3';

    const vertex = generateVertexBlock({ flags, locations });

    const fragment = /* glsl */`#version 300 es
        precision highp float;

        ${settingsUniformBlock}
        ${frustumUniformBlock}
        
        in vec3 v_position;

        in vec4 v_texCoord;

        ${flags.hasAttr['COLOR_0'] ? /* glsl */`in ${color0Type} v_color0;` : ''}

        ${flags.hasAttr['NORMAL'] ? /* glsl */`
        in vec3 v_normal;
        ${flags.hasAttr['TANGENT'] ? /* glsl */`
        in vec3 v_tangent;
        in vec3 v_bitangent;
        ` : ''}
        ` : ''}
        in vec3 v_modelScale;

        ${flags.useShadows ? /* glsl */`
        in vec4 v_ShadowTexcoords[6];
        ` : ''}

        ${flags.colorTargets.id ? /* glsl */`
        flat in uint v_graphId;
        `: ''}

        ${flags.colorTargets.motion ? /* glsl */`
        in vec4 v_motionPosition;
        in vec4 v_motionPositionPrev;
        `: ''}

        
        layout(location=0) out vec4  g_finalColor;
        layout(location=1) out vec4  g_finalAccum;
        layout(location=2) out float g_finalReveal;
        layout(location=3) out vec4  g_finalPointInfo;
        layout(location=4) out uint  g_finalPointId;
        layout(location=5) out vec2  g_finalMotionVector;

        ${formulasBlock}

        float getLinearDepth(float d) {
            return frustum.near * frustum.far / (frustum.far + d * (frustum.near - frustum.far));
        }

        float alphaWeight(float z, float a) {
            float d = ((frustum.near * frustum.far) / (z - frustum.far)) / (frustum.near - frustum.far);
            return a * max(1e-2, 3e3 * pow(1.0 - d, 3.0));
        }

        ${generateMaterialBlock({ flags, locations })}
        ${generateLightingBlock({ flags, locations })}

        void main(void) {
            ${flags.colorTargets.color || flags.colorTargets.point ? /* glsl */`
                normalInfo = getNormalInfo();
            ` : ''}

            ${flags.colorTargets.point ? /* glsl */`
                g_finalPointInfo = vec4(gl_FragCoord.z, normalize(mat3(frustum.viewMatrix) * normalInfo.n * 0.5 + 0.5));
            `: ''}

            ${flags.colorTargets.id ? /* glsl */`
                g_finalPointId = v_graphId;
            `: ''}

            ${flags.colorTargets.motion ? /* glsl */`
                vec2 a = (v_motionPosition.xy / v_motionPosition.w) * 0.5 + 0.5;
                vec2 b = (v_motionPositionPrev.xy / v_motionPositionPrev.w) * 0.5 + 0.5;
                g_finalMotionVector = a - b;
            `: ''}

            ${flags.colorTargets.color ? /* glsl */`
                materialInfo = getMaterialInfo();

                ${flags.isMask ? /* glsl */`
                    if (materialInfo.baseColor.a < material.alphaCutoff) {
                        discard;
                    }
                ` : ''} 
                
                ${flags.hasExtension?.KHR_materials_unlit ? /* glsl */`
                    g_finalColor = (vec4(linearTosRGB(materialInfo.baseColor.rgb), materialInfo.baseColor.a));
                ` : /* glsl */`
                    lightInfo  = getLightInfo();
                    
                    ${flags.useEnvironment ? /* glsl */`applyEnvironment();`: ''}
                    applyOcclusion(gl_FragCoord.xy);
                    ${flags.usePunctual ? /* glsl */`applyPunctual();`: ''}
                    ${flags.useTransmission ? /* glsl */`applyTransmission();`: ''}
                    
                    g_finalColor = applyLighting();

                    ${!flags.useLinear ? /* glsl */`
                        g_finalColor = vec4(linearTosRGB(applyToneMap(g_finalColor.rgb)), g_finalColor.a);
                    `: ''}

                    ${flags.useFog ? /* glsl */`
                        float dist = getLinearDepth(gl_FragCoord.z);
                        float fog = (settings.fog.range.y - dist) / (settings.fog.range.x - settings.fog.range.y);
                        fog = clamp(fog, 0.0, 1.0);
                        g_finalColor = mix(g_finalColor, settings.fog.color, fog);
                    `: ''}
                `}

                ${flags.colorTargets.blend && flags.writeMasks.blend ? /* glsl */`
                    /** @see https://learnopengl.com/Guest-Articles/2020/OIT/Weighted-Blended */
                    float weight = alphaWeight(gl_FragCoord.z, g_finalColor.a);
                    
                    g_finalAccum  = vec4(g_finalColor.rgb * g_finalColor.a, g_finalColor.a) * weight;
                    g_finalReveal = g_finalColor.a;
                `: ''}

                ${flags.debug?.pbr?.enabled ? /* glsl */`
                    ${PBR_DEBUG_MODES[flags.debug.pbr.mode]?.glsl ?? ''}
                `: ''}               
            ` : ''}
        }
    `;

    return { vertex, fragment };
}

export default generate;