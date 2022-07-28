import { Settings } from '../../settings.js';
import { Frustum  } from '../../frustum.js';

import generateUniformBlock  from './uniform.glsl.js';
import generateModelBlock    from './model.glsl.js';
import generateFormulasBlock from './formulas.glsl.js';
import generateLightingBlock from './lighting.glsl.js';
import generateMaterialBlock from './material.glsl.js';

import { PBR_DEBUG_MODES } from '../../constants.js';

const formulasBlock        = generateFormulasBlock();
const settingsUniformBlock = generateUniformBlock(Settings, 0, 0);
const frustumUniformBlock  = generateUniformBlock(Frustum, 1, 0);

export function generate({ flags, locations }) {
    const positionType = flags.hasPostionVec4  ? 'vec4': 'vec3';
    const normalType   = flags.hasNormalVec4   ? 'vec4': 'vec3';
    const color0Type   = flags.hasColor0Vec4   ? 'vec4': 'vec3';

    const vertex = /* glsl */`#version 300 es
        precision highp float;
        precision mediump int;
        precision highp sampler2DArray;

        ${settingsUniformBlock}
        ${frustumUniformBlock}

        // struct VertexInput {
        layout(location=0) in uvec4 a_graph;

        ${flags.hasAttr['POSITION']   ? /* glsl */`layout(location=${locations.attr['POSITION']})   in ${positionType} a_position;` : ''}
        ${flags.hasAttr['NORMAL']     ? /* glsl */`layout(location=${locations.attr['NORMAL']})     in ${normalType}   a_normal;`   : ''}
        ${flags.hasAttr['TANGENT']    ? /* glsl */`layout(location=${locations.attr['TANGENT']})    in vec4 a_tangent;`   : ''}
        ${flags.hasAttr['TEXCOORD_0'] ? /* glsl */`layout(location=${locations.attr['TEXCOORD_0']}) in vec2 a_texCoord0;` : ''}
        ${flags.hasAttr['TEXCOORD_1'] ? /* glsl */`layout(location=${locations.attr['TEXCOORD_1']}) in vec2 a_texCoord1;` : ''}
        ${flags.hasAttr['JOINTS_0']   ? /* glsl */`layout(location=${locations.attr['JOINTS_0']})   in uvec4 a_joints0;`  : ''}
        ${flags.hasAttr['JOINTS_1']   ? /* glsl */`layout(location=${locations.attr['JOINTS_1']})   in uvec4 a_joints1;`  : ''}
        ${flags.hasAttr['WEIGHTS_0']  ? /* glsl */`layout(location=${locations.attr['WEIGHTS_0']})  in vec4 a_weights0;`  : ''}
        ${flags.hasAttr['WEIGHTS_1']  ? /* glsl */`layout(location=${locations.attr['WEIGHTS_1']})  in vec4 a_weights1;`  : ''}
        ${flags.hasAttr['COLOR_0']    ? /* glsl */`layout(location=${locations.attr['COLOR_0']})    in ${color0Type} a_color0;` : ''}
        
        // };
        
        // struct VertexOutput {
        out vec3 v_position;
        out vec2 v_texCoord0;
        out vec2 v_texCoord1;

        ${flags.hasAttr['COLOR_0'] ? /* glsl */`out ${color0Type} v_color0;` : ''}

        ${flags.hasAttr['NORMAL'] ? /* glsl */`
        out vec3 v_normal;
        ${flags.hasAttr['TANGENT'] ? /* glsl */`
        out vec3 v_tangent;
        out vec3 v_bitangent;
        ` : ''}
        ` : ''}
        out vec3 v_modelScale;
        
        ${generateModelBlock({ flags, locations })}

        void main(void){
            ModelInfo modelInfo = getModelInfo(a_graph);

            vec4 pos = modelInfo.matrix * getPosition(modelInfo);

            gl_Position = frustum.viewProjectionMatrix * pos;

            // geometry only is finished at this point
            v_position  = pos.xyz / pos.w;

            ${flags.hasAttr['NORMAL'] ? /* glsl */`
            v_normal = normalize((modelInfo.normalMatrix * vec4(getNormal(modelInfo), 0.0)).xyz);
            ${flags.hasAttr['TANGENT'] ? /* glsl */`
            vec3 tangent = getTangent(modelInfo);
            v_tangent    = normalize((modelInfo.matrix * vec4(tangent, 0.0)).xyz);
            v_bitangent  = cross(v_normal, v_tangent) * a_tangent.w;
            ` : ''}
            ` : ''}

            v_modelScale.x = length(vec3(modelInfo.matrix[0].xyz));
            v_modelScale.y = length(vec3(modelInfo.matrix[1].xyz));
            v_modelScale.z = length(vec3(modelInfo.matrix[2].xyz));
            
            
            ${flags.hasAttr['TEXCOORD_0'] ? /* glsl */`v_texCoord0 = a_texCoord0;`: ''}
            ${flags.hasAttr['TEXCOORD_1'] ? /* glsl */`v_texCoord1 = a_texCoord1;`: ''}

            ${flags.hasAttr['COLOR_0'] || flags.hasColor0Vec4 ? /* glsl */`v_color0 = a_color0;`: ''}
        }
    `;

    const fragment = /* glsl */`#version 300 es
        precision highp float;

        ${settingsUniformBlock}
        ${frustumUniformBlock}
        
        in vec3 v_position;

        in vec2 v_texCoord0;
        in vec2 v_texCoord1;

        ${flags.hasAttr['COLOR_0'] ? /* glsl */`in ${color0Type} v_color0;` : ''}

        ${flags.hasAttr['NORMAL'] ? /* glsl */`
        in vec3 v_normal;
        ${flags.hasAttr['TANGENT'] ? /* glsl */`
        in vec3 v_tangent;
        in vec3 v_bitangent;
        ` : ''}
        ` : ''}
        in vec3 v_modelScale;

        layout(location=0) out vec4 g_finalColor;
        ${flags.storePointInfo ? /* glsl */`
        layout(location=1) out vec4 g_finalPoint;
        `: ''}
        

        ${formulasBlock}

        ${generateMaterialBlock({ flags, locations })}
        ${generateLightingBlock({ flags, locations })}

        float getLinearDepth(float d) {
            return frustum.near * frustum.far / (frustum.far + d * (frustum.near - frustum.far));
        }

        void main(void) {
            normalInfo   = getNormalInfo();
            materialInfo = getMaterialInfo();

            ${flags.hasExtension?.KHR_materials_unlit ? /* glsl */`
                g_finalColor = (vec4(linearTosRGB(materialInfo.baseColor.rgb), materialInfo.baseColor.a));
            ` : /* glsl */`
                lightInfo  = getLightInfo();
                
                ${flags.useEnvironment ? /* glsl */`applyEnvironment();`: ''}
                applyOcclusion(gl_FragCoord.xy);
                ${flags.usePunctual ? /* glsl */`applyPunctualLights();`: ''}
                ${flags.usePunctual ||  flags.useEnvironment ? /* glsl */`applyTransmission();`: ''}
                
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

                ${flags.debug?.pbr?.enabled ? /* glsl */`
                    ${PBR_DEBUG_MODES[flags.debug.pbr.mode]?.glsl || ''}
                `: ''}
            `}

            ${flags.storePointInfo ? /* glsl */`
            g_finalPoint = vec4(gl_FragCoord.z, normalize(mat3(frustum.viewMatrix) * normalInfo.n * 0.5 + 0.5));
            `: ''}
        }
    `;

    return { vertex, fragment };
}

export default generate;