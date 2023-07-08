import { Frustum  } from '../../../../../frustum.js';
import { Punctual } from '../../../../../punctual.js';

import generateUniformBlock from '../uniform.wgsl.js';

import generateModelBlock from './model.wgsl.js';

const frustumUniformBlock  = generateUniformBlock(Frustum,  1, 0);
const punctualUniformBlock = generateUniformBlock(Punctual, 2, '$$binding');

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

            ${flags.hasAttr['COLOR_0'] ? /* wgsl */`@location(2) color0: ${color0Type}<f32>,` : ''}

            ${flags.hasAttr['NORMAL'] ? /* wgsl */`
            @location(3) normal: vec3<f32>,
            ${flags.hasAttr['TANGENT'] ? /* wgsl */`
            @location(4) tangent: vec3<f32>,
            @location(5) bitangent: vec3<f32>,
            ` : ''}
            ` : ''}

            @location(6) modelScale: vec3<f32>,

            ${flags.useShadows ? /* wgsl */`
            @location(7)  shadowTexcoords0: vec4<f32>,
            @location(8)  shadowTexcoords1: vec4<f32>,
            @location(9)  shadowTexcoords2: vec4<f32>,
            @location(10) shadowTexcoords3: vec4<f32>,
            @location(11) shadowTexcoords4: vec4<f32>,
            @location(12) shadowTexcoords5: vec4<f32>,
            ` : ''}

            ${flags.colorTargets.id ? /* wgsl */`
            @location(13) @interpolate(flat) graphId: u32,
            ` : ''} 

            ${flags.colorTargets.motion ? /* wgsl */`
            @location(13) motionPosition: vec4<f32>,
            @location(14) motionPositionPrev: vec4<f32>,
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
            out.normal = normalize((modelInfo.normalMatrix * vec4<f32>(getNormal(modelInfo), 0.0)).xyz);
            ${flags.hasAttr['TANGENT'] ? /* wgsl */`
            var tangent   = getTangent(modelInfo);
            out.tangent   = normalize((modelInfo.matrix * vec4<f32>(tangent, 0.0)).xyz);
            out.bitangent = cross(out.normal, out.tangent) * in.tangent.w;
            ` : ''}
            ` : ''}

            out.modelScale.x = length(vec3<f32>(modelInfo.matrix[0].xyz));
            out.modelScale.y = length(vec3<f32>(modelInfo.matrix[1].xyz));
            out.modelScale.z = length(vec3<f32>(modelInfo.matrix[2].xyz));

            ${flags.hasAttr['TEXCOORD_0'] ? /* wgsl */`out.texCoord = vec4<f32>(in.texCoord0, 0.0, 0.0);`: ''}
            ${flags.hasAttr['TEXCOORD_1'] ? /* wgsl */`out.texCoord = vec4<f32>(in.texCoord0, in.texCoord1);`: ''}

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