import { Frustum  } from '../../../../../frustum.js';
import { Punctual } from '../../../../../punctual.js';

import generateModelBlock from './model.wgsl.js';

const frustumUniformBlock  = Frustum.generateUniformBlock('wgsl', 1, 0);
const punctualUniformBlock = Punctual.generateUniformBlock('wgsl', 2, '$$binding');

export function generate({ flags, locations }) {
    const positionType = flags.hasPostionVec4  ? 'vec4': 'vec3';
    const normalType   = flags.hasNormalVec4   ? 'vec4': 'vec3';
    const color0Type   = flags.hasColor0Vec4   ? 'vec4': 'vec3';

    const vertex = /* wgsl */`
        ${frustumUniformBlock}

        ${flags.useShadows ? punctualUniformBlock.replace('$$binding', locations.bindGroup.punctual) : ''}

        struct VertexInput {
            @builtin(vertex_index) vertexID: u32,

            @location(0) graph: vec4<u32>,

            ${flags.hasAttr['POSITION']   ? /* wgsl */`@location(${locations.attr['POSITION']})   position:  ${positionType}<f32>,` : ''}
            ${flags.hasAttr['NORMAL']     ? /* wgsl */`@location(${locations.attr['NORMAL']})     normal:    ${normalType}<f32>,`   : ''}
            ${flags.hasAttr['TANGENT']    ? /* wgsl */`@location(${locations.attr['TANGENT']})    tangent:   vec4<f32>,` : ''}
            ${flags.hasAttr['TEXCOORD_0'] ? /* wgsl */`@location(${locations.attr['TEXCOORD_0']}) texCoord0: vec2<f32>,` : ''}
            ${flags.hasAttr['TEXCOORD_1'] ? /* wgsl */`@location(${locations.attr['TEXCOORD_1']}) texCoord1: vec2<f32>,` : ''}
            ${flags.hasAttr['JOINTS_0']   ? /* wgsl */`@location(${locations.attr['JOINTS_0']})   joints0:   vec4<u32>,` : ''}
            ${flags.hasAttr['JOINTS_1']   ? /* wgsl */`@location(${locations.attr['JOINTS_1']})   joints1:   vec4<u32>,` : ''}
            ${flags.hasAttr['WEIGHTS_0']  ? /* wgsl */`@location(${locations.attr['WEIGHTS_0']})  weights0:  vec4<f32>,` : ''}
            ${flags.hasAttr['WEIGHTS_1']  ? /* wgsl */`@location(${locations.attr['WEIGHTS_1']})  weights1:  vec4<f32>,` : ''}
            ${flags.hasAttr['COLOR_0']    ? /* wgsl */`@location(${locations.attr['COLOR_0']})    color0: ${color0Type}<f32>,` : ''}
        };

        struct VertexOutput {
            @builtin(position) gl_Position: vec4<f32>,

            @location(0) position: vec3<f32>,
            @location(1) texCoord: vec4<f32>,

            // we compact normal, tangent, bitangent, and scale into these 3 varyings
            @location(2) modelInfo0: vec4<f32>,
            @location(3) modelInfo1: vec4<f32>,
            @location(4) modelInfo2: vec4<f32>,

            ${flags.hasAttr['COLOR_0'] ? /* wgsl */`@location(5) color0: ${color0Type}<f32>,` : ''}

            ${flags.useShadows ? /* wgsl */`
            @location(6)  shadowTexcoords0: vec4<f32>,
            @location(7)  shadowTexcoords1: vec4<f32>,
            @location(8)  shadowTexcoords2: vec4<f32>,
            @location(9)  shadowTexcoords3: vec4<f32>,
            @location(10) shadowTexcoords4: vec4<f32>,
            @location(11) shadowTexcoords5: vec4<f32>,
            ` : ''}

            ${flags.colorTargets.motion ? /* wgsl */`
            @location(12) motionPosition: vec4<f32>,
            @location(13) motionPositionPrev: vec4<f32>,
            ` : ''}

            ${flags.colorTargets.id ? /* wgsl */`
            @location(14) @interpolate(flat) graphId: u32,
            ` : ''}

            ${flags.useBarycentric ? /* wgsl */`
            @location(15) barycentric: vec3<f32>,
            `: ''}
        };

        var<private> in: VertexInput;

        ${generateModelBlock({ flags, locations })}

        @vertex
        fn main(input: VertexInput) -> VertexOutput {
            in = input;

            var out: VertexOutput;

            var modelInfo = getModelInfo();

            out.gl_Position = frustum.viewProjectionMatrix * modelInfo.position;

            // geometry only is finished at this point
            out.position = modelInfo.position.xyz / modelInfo.position.w;

            ${flags.hasAttr['NORMAL'] ? /* wgsl */`
            out.modelInfo0 = vec4<f32>(normalize((modelInfo.normalMatrix * vec4<f32>(getNormal(modelInfo), 0.0)).xyz), 0.0);
            ${flags.hasAttr['TANGENT'] ? /* wgsl */`
            var tangent    = getTangent(modelInfo);
            out.modelInfo1 = vec4<f32>(normalize((modelInfo.matrix * vec4<f32>(tangent, 0.0)).xyz), 0.0);
            out.modelInfo2 =  vec4<f32>(cross(out.modelInfo0.xyz, out.modelInfo1.xyz) * in.tangent.w, 0.0);
            ` : ''}
            ` : ''}

            out.modelInfo0.w = length(vec3<f32>(modelInfo.matrix[0].xyz));
            out.modelInfo1.w = length(vec3<f32>(modelInfo.matrix[1].xyz));
            out.modelInfo2.w = length(vec3<f32>(modelInfo.matrix[2].xyz));


            ${flags.hasAttr['TEXCOORD_0'] ? /* wgsl */`var tc0 = getTexCoord0(modelInfo); out.texCoord.x = tc0.x; out.texCoord.y = tc0.y;`: ''}
            ${flags.hasAttr['TEXCOORD_1'] ? /* wgsl */`var tc1 = getTexCoord1(modelInfo); out.texCoord.z = tc1.x; out.texCoord.w = tc1.y;`: ''}

            ${flags.hasAttr['COLOR_0'] ? /* wgsl */`out.color0 = in.color0;`: ''}

            ${flags.useShadows ? /* wgsl */`
                out.shadowTexcoords0 = punctual.shadowMatrices[0] * modelInfo.position;
                out.shadowTexcoords1 = punctual.shadowMatrices[1] * modelInfo.position;
                out.shadowTexcoords2 = punctual.shadowMatrices[2] * modelInfo.position;
                out.shadowTexcoords3 = punctual.shadowMatrices[3] * modelInfo.position;
                out.shadowTexcoords4 = punctual.shadowMatrices[4] * modelInfo.position;
                out.shadowTexcoords5 = punctual.shadowMatrices[5] * modelInfo.position;
            `: ''}

            ${flags.colorTargets.id ? /* wgsl */`
            out.graphId = in.graph.w;
            ` : ''}

            ${flags.colorTargets.motion ? /* wgsl */`
                var historyInfo        = getModelInfoHistory();
                out.motionPosition     = out.gl_Position;
                out.motionPositionPrev = frustum.prevViewProjectionMatrix * historyInfo.position;
            `: ''}

            out.gl_Position += vec4<f32>(frustum.jitter * out.gl_Position.w, 0.0, 0.0);

            ${flags.useBarycentric ? /* wgsl */`
            var id = in.vertexID % 3;
            out.barycentric.x = f32(id == 0);
            out.barycentric.y = f32(id == 1);
            out.barycentric.z = f32(id == 2);
            `: ''}

            return out;
        }
    `;

    return vertex;
}

export default generate;
