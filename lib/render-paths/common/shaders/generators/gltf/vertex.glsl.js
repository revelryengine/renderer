import { Frustum  } from '../../../../../frustum.js';

import generateModelBlock from './model.glsl.js';

const frustumUniformBlock  = Frustum.generateUniformBlock('glsl', 1, 0);

/**
 * @param {import('../../shader.js').ShaderInitialized<import('../../gltf-shader.js').GLTFShader>} shader
 */
export function generate(shader) {
    const { flags, locations, input: { renderNode: { punctual } } } = shader;

    const positionType = flags.hasPostionVec4  ? 'vec4': 'vec3';
    const normalType   = flags.hasNormalVec4   ? 'vec4': 'vec3';
    const color0Type   = flags.hasColor0Vec4   ? 'vec4': 'vec3';

    const vertex = /* glsl */`#version 300 es
        precision highp float;
        precision mediump int;
        precision highp sampler2DArray;

        ${frustumUniformBlock}

        ${flags.useShadows ? punctual.generateUniformBlock(2, locations.bindGroup.punctual) : ''}

        // struct VertexInput {
        layout(location=0) in highp uvec4 a_graph;

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
        out vec4 v_texCoord;

        // we compact normal, tangent, bitangent, and scale into these 3 varyings
        out vec4 v_modelInfo0;
        out vec4 v_modelInfo1;
        out vec4 v_modelInfo2;

        ${flags.hasAttr['COLOR_0'] ? /* glsl */`out ${color0Type} v_color0;` : ''}

        ${flags.useShadows ? /* glsl */`
        out vec4 v_shadowTexcoords[6];
        ` : ''}

        ${flags.colorTargets.motion ? /* glsl */`
        out vec4 v_motionPosition;
        out vec4 v_motionPositionPrev;
        ` : ''}

        ${flags.colorTargets.id ? /* glsl */`
        flat out highp uint v_graphId;
        ` : ''}

        ${flags.useBarycentric ? /* glsl */`
        out vec3 v_barycentric;
        `: ''}
        // };

        ${generateModelBlock(shader)}

        void main(void){
            ModelInfo modelInfo = getModelInfo(a_graph);

            gl_Position = frustum.viewProjectionMatrix * modelInfo.position;


            // geometry only is finished at this point
            v_position  = modelInfo.position.xyz / modelInfo.position.w;

            ${flags.hasAttr['NORMAL'] ? /* glsl */`
            v_modelInfo0.xyz = normalize((modelInfo.normalMatrix * vec4(getNormal(modelInfo), 0.0)).xyz);

            ${flags.hasAttr['TANGENT'] ? /* glsl */`
            vec3 tangent = getTangent(modelInfo);
            v_modelInfo1.xyz = normalize((modelInfo.matrix * vec4(tangent, 0.0)).xyz);
            v_modelInfo2.xyz = cross(v_modelInfo0.xyz, v_modelInfo1.xyz) * a_tangent.w;
            ` : ''}
            ` : ''}

            v_modelInfo0.w = length(vec3(modelInfo.matrix[0].xyz));
            v_modelInfo1.w = length(vec3(modelInfo.matrix[1].xyz));
            v_modelInfo2.w = length(vec3(modelInfo.matrix[2].xyz));

            ${flags.hasAttr['TEXCOORD_0'] ? /* glsl */`v_texCoord.xy = getTexCoord0(modelInfo);`: ''}
            ${flags.hasAttr['TEXCOORD_1'] ? /* glsl */`v_texCoord.zw = getTexCoord1(modelInfo);`: ''}

            ${flags.hasAttr['COLOR_0'] || flags.hasColor0Vec4 ? /* glsl */`v_color0 = a_color0;`: ''}

            ${flags.useShadows ? /* glsl */`
            for (int i = 0; i < punctual.shadowCount; ++i) {
                v_shadowTexcoords[i] = punctual.shadowMatrices[i] * modelInfo.position;
            }
            `: ''}

            ${flags.colorTargets.id ? /* glsl */`
            v_graphId = a_graph.w;
            ` : ''}

            ${flags.colorTargets.motion ? /* glsl */`
            ModelInfo historyInfo = getModelInfoHistory(a_graph);
            v_motionPosition      = gl_Position;
            v_motionPositionPrev  = frustum.prevViewProjectionMatrix * historyInfo.position;
            `: ''}

            gl_Position += vec4(frustum.jitter * gl_Position.w, 0.0, 0.0);

            ${flags.useBarycentric ? /* glsl */`
            int id = gl_VertexID % 3;
            v_barycentric.x = float(id == 0);
            v_barycentric.y = float(id == 1);
            v_barycentric.z = float(id == 2);
            `: ''}
        }
    `;

    return vertex;
}

export default generate;
