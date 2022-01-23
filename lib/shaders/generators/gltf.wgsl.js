import { Frustum } from '../../frustum.js';

import generateUniformBlock  from './uniform.wgsl.js';
import generateModelBlock    from './model.wgsl.js';
import generateFormulasBlock from './formulas.wgsl.js';
import generateLightingBlock from './lighting.wgsl.js';
import generateMaterialBlock from './material.wgsl.js';
import { PBR_DEBUG_MODES } from '../../constants.js';

const formulasBlock       = generateFormulasBlock();
const frustumUniformBlock = generateUniformBlock(Frustum, 1, 0);

export function generate({ flags, locations }) {  
    const color0Type = flags.hasColor0Vec3 ? 'vec3': 'vec4';

    const vertex = /*wgsl*/`
        ${frustumUniformBlock}

        struct VertexInput {
            [[builtin(vertex_index)]] vertexID: u32;

            [[location(0)]] graph: vec4<u32>;

            ${flags.hasAttr['POSITION']   ? /*wgsl*/`[[location(${locations.attr['POSITION']})]]   position: vec3<f32>;`  : ''}
            ${flags.hasAttr['NORMAL']     ? /*wgsl*/`[[location(${locations.attr['NORMAL']})]]     normal: vec3<f32>;`    : ''}
            ${flags.hasAttr['TANGENT']    ? /*wgsl*/`[[location(${locations.attr['TANGENT']})]]    tangent: vec4<f32>;`   : ''}
            ${flags.hasAttr['TEXCOORD_0'] ? /*wgsl*/`[[location(${locations.attr['TEXCOORD_0']})]] texCoord0: vec2<f32>;` : ''}
            ${flags.hasAttr['TEXCOORD_1'] ? /*wgsl*/`[[location(${locations.attr['TEXCOORD_1']})]] texCoord1: vec2<f32>;` : ''}
            ${flags.hasAttr['JOINTS_0']   ? /*wgsl*/`[[location(${locations.attr['JOINTS_0']})]]   joints0: vec4<u32>;`   : ''}
            ${flags.hasAttr['JOINTS_1']   ? /*wgsl*/`[[location(${locations.attr['JOINTS_1']})]]   joints1: vec4<u32>;`   : ''}
            ${flags.hasAttr['WEIGHTS_0']  ? /*wgsl*/`[[location(${locations.attr['WEIGHTS_0']})]]  weights0: vec4<f32>;`  : ''}
            ${flags.hasAttr['WEIGHTS_1']  ? /*wgsl*/`[[location(${locations.attr['WEIGHTS_1']})]]  weights1: vec4<f32>;`  : ''}
            ${flags.hasAttr['COLOR_0']    ? /*wgsl*/`[[location(${locations.attr['COLOR_0']})]]    color0: ${color0Type}<f32>;` : ''}
        };

        struct VertexOutput {
            [[builtin(position)]] gl_Position: vec4<f32>;
            [[location(0)]] position: vec3<f32>;

            [[location(1)]] texCoord0: vec2<f32>;
            [[location(2)]] texCoord1: vec2<f32>;

            ${flags.hasAttr['COLOR_0'] ? /*wgsl*/`[[location(3)]] color0: ${color0Type}<f32>;` : ''}

            ${flags.hasAttr['NORMAL'] ? /* wgsl */`
            [[location(4)]] normal: vec3<f32>;
            ${flags.hasAttr['TANGENT'] ? /* wgsl */`
            [[location(5)]] tangent: vec3<f32>;
            [[location(6)]] bitangent: vec3<f32>;
            ` : ''}
            ` : ''}

            [[location(7)]] modelScale: vec3<f32>;
        };

        var<private> in: VertexInput;

        ${generateModelBlock({ flags, locations })}

        [[stage(vertex)]]
        fn main(input: VertexInput) -> VertexOutput {
            in = input;

            var out: VertexOutput;

            var modelInfo = getModelInfo();

            var pos = modelInfo.matrix * getPosition(modelInfo);

            out.gl_Position = frustum.viewProjectionMatrix * pos;

            // geometry only is finished at this point
            out.position = pos.xyz / pos.w;

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

            ${flags.hasAttr['TEXCOORD_0'] ? /* wgsl */`out.texCoord0 = in.texCoord0;`: ''}
            ${flags.hasAttr['TEXCOORD_1'] ? /* wgsl */`out.texCoord1 = in.texCoord1;`: ''}

            ${flags.hasAttr['COLOR_0'] ? /* wgsl */`out.color0 = in.color0;`: ''}

            return out;
        }

        
    `;

    const fragment = /* wgsl */`
        ${frustumUniformBlock}

        struct FragmentInput {
            [[builtin(position)]] gl_Position: vec4<f32>;
            [[location(0)]] position: vec3<f32>;

            [[location(1)]] texCoord0: vec2<f32>;
            [[location(2)]] texCoord1: vec2<f32>;

            ${flags.hasAttr['COLOR_0'] ? /*wgsl*/`[[location(3)]] color0: ${color0Type}<f32>;` : ''}

            ${flags.hasAttr['NORMAL'] ? /* wgsl */`
            [[location(4)]] normal: vec3<f32>;
            ${flags.hasAttr['TANGENT'] ? /* wgsl */`
            [[location(5)]] tangent: vec3<f32>;
            [[location(6)]] bitangent: vec3<f32>;
            ` : ''}
            ` : ''}
            [[location(7)]] modelScale: vec3<f32>;

            [[builtin(front_facing)]] frontFacing: bool;
        };

        var<private> in: FragmentInput;

        struct FragmentOutput {
            [[location(0)]] color: vec4<f32>;
        };

        ${formulasBlock}

        ${generateMaterialBlock({ flags, locations })}
        ${generateLightingBlock({ flags, locations })}
        
        [[stage(fragment)]]
        fn main(input: FragmentInput) -> FragmentOutput {
            in = input;

            var out: FragmentOutput;

            normalInfo   = getNormalInfo();
            materialInfo = getMaterialInfo();

            ${flags.isMask ? /* wgsl */`
            if (materialInfo.baseColor.a < material.alphaCutoff) {
                discard;
            }
            materialInfo.baseColor.a = 1.0;
            ` : ''} 

            ${flags.hasExtension?.KHR_materials_unlit ? /* wgsl */`
                out.color = vec4<f32>(linearTosRGB(materialInfo.baseColor.rgb), materialInfo.baseColor.a);
            ` : /* wgsl */`
                lightInfo  = getLightInfo();
                
                ${flags.useEnvironment ? /* wgsl */`applyEnvironment();`: ''}
                applyOcclusion();
                ${flags.usePunctual ? /* wgsl */`applyPunctualLights();`: ''} // this is really slow in webgpu (check sponza zoomed in)
                ${flags.hasExtension?.KHR_materials_transmission ? /* wgsl */`applyTransmission();`: ''}

                out.color = applyLighting();

                ${!flags.useLinear ? /* wgsl */`
                out.color = vec4<f32>(linearTosRGB(applyToneMap(out.color.rgb)), out.color.a);
                `: ''}

                ${flags.debug?.pbr?.enabled ? /* wgsl */`
                    ${PBR_DEBUG_MODES[flags.debug.pbr.mode]?.wgsl || ''}
                `: ''}

            `}

            return out;
        }
    `;

    return { vertex, fragment };
}

export default generate;