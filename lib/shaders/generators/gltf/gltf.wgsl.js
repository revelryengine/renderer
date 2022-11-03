import { Settings } from '../../../settings.js';
import { Punctual } from '../../../punctual.js';
import { Frustum  } from '../../../frustum.js';

import generateFormulasBlock from '../formulas.wgsl.js';
import generateUniformBlock  from '../uniform.wgsl.js';
import generateModelBlock    from './model.wgsl.js';
import generateLightingBlock from './lighting.wgsl.js';
import generateMaterialBlock from './material.wgsl.js';

import { PBR_DEBUG_MODES } from '../../../constants.js';

const formulasBlock        = generateFormulasBlock();
const settingsUniformBlock = generateUniformBlock(Settings, 0, 0);
const frustumUniformBlock  = generateUniformBlock(Frustum, 1, 0);
const punctualUniformBlock = generateUniformBlock(Punctual, 2, '$$binding');

export function generate({ flags, locations }) {  
    const positionType = flags.hasPostionVec4  ? 'vec4': 'vec3';
    const normalType   = flags.hasNormalVec4   ? 'vec4': 'vec3';
    const color0Type   = flags.hasColor0Vec4   ? 'vec4': 'vec3';

    const vertex = /* wgsl */`
        ${settingsUniformBlock}
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

            @location(1) texCoord0: vec2<f32>,
            @location(2) texCoord1: vec2<f32>,

            ${flags.hasAttr['COLOR_0'] ? /* wgsl */`@location(3) color0: ${color0Type}<f32>,` : ''}

            ${flags.hasAttr['NORMAL'] ? /* wgsl */`
            @location(4) normal: vec3<f32>,
            ${flags.hasAttr['TANGENT'] ? /* wgsl */`
            @location(5) tangent: vec3<f32>,
            @location(6) bitangent: vec3<f32>,
            ` : ''}
            ` : ''}

            @location(7) modelScale: vec3<f32>,

            ${flags.useShadows ? /* wgsl */`
            @location(8)  shadowTexcoords0: vec4<f32>,
            @location(9)  shadowTexcoords1: vec4<f32>,
            @location(10) shadowTexcoords2: vec4<f32>,
            @location(11) shadowTexcoords3: vec4<f32>,
            @location(12) shadowTexcoords4: vec4<f32>,
            @location(13) shadowTexcoords5: vec4<f32>,
            ` : ''} 
        };

        var<private> in: VertexInput;

        ${generateModelBlock({ flags, locations })}

        @vertex
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

            ${flags.useShadows ? /* wgsl */`
                out.shadowTexcoords0 = punctual.shadowMatrices[0] * pos;
                out.shadowTexcoords1 = punctual.shadowMatrices[1] * pos;
                out.shadowTexcoords2 = punctual.shadowMatrices[2] * pos;
                out.shadowTexcoords3 = punctual.shadowMatrices[3] * pos;
                out.shadowTexcoords4 = punctual.shadowMatrices[4] * pos;
                out.shadowTexcoords5 = punctual.shadowMatrices[5] * pos;
            `: ''}

            return out;
        }
    `;
    
    let fragment;

    if(!flags.shadowPass) {
        fragment = /* wgsl */`
            ${settingsUniformBlock}
            ${frustumUniformBlock}

            struct FragmentInput {
                @builtin(position) gl_FragCoord: vec4<f32>,
                @location(0) position: vec3<f32>,

                @location(1) texCoord0: vec2<f32>,
                @location(2) texCoord1: vec2<f32>,

                ${flags.hasAttr['COLOR_0'] ? /* wgsl */`@location(3) color0: ${color0Type}<f32>,` : ''}

                ${flags.hasAttr['NORMAL'] ? /* wgsl */`
                @location(4) normal: vec3<f32>,
                ${flags.hasAttr['TANGENT'] ? /* wgsl */`
                @location(5) tangent: vec3<f32>,
                @location(6) bitangent: vec3<f32>,
                ` : ''}
                ` : ''}
                @location(7) modelScale: vec3<f32>,

                ${flags.useShadows ? /* wgsl */`
                @location(8)  shadowTexcoords0: vec4<f32>,
                @location(9)  shadowTexcoords1: vec4<f32>,
                @location(10) shadowTexcoords2: vec4<f32>,
                @location(11) shadowTexcoords3: vec4<f32>,
                @location(12) shadowTexcoords4: vec4<f32>,
                @location(13) shadowTexcoords5: vec4<f32>,
                ` : ''}

                @builtin(front_facing) frontFacing: bool,
            };

            var<private> in: FragmentInput;

            ${flags.useShadows ? /* wgsl */`
            var<private> shadowTexcoords : array<vec4<f32>, 6>;
            ` : ''} 

            struct FragmentOutput {
                @location(0) color: vec4<f32>,
                ${flags.storePointInfo ? /* wgsl */`
                @location(1) pointInfo: vec4<f32>,
                `: ''}
            };

            ${formulasBlock}

            fn getLinearDepth(d: f32) -> f32 {
                return frustum.near * frustum.far / (frustum.far + d * (frustum.near - frustum.far));
            }

            ${generateMaterialBlock({ flags, locations })}
            ${generateLightingBlock({ flags, locations })}
            
            @fragment
            fn main(input: FragmentInput) -> FragmentOutput {
                in = input;

                ${flags.useShadows ? /* wgsl */`
                    shadowTexcoords[0] = in.shadowTexcoords0;
                    shadowTexcoords[1] = in.shadowTexcoords1;
                    shadowTexcoords[2] = in.shadowTexcoords2;
                    shadowTexcoords[3] = in.shadowTexcoords3;
                    shadowTexcoords[4] = in.shadowTexcoords4;
                    shadowTexcoords[5] = in.shadowTexcoords5;
                `: ''}

                var out: FragmentOutput;

                normalInfo   = getNormalInfo();
                materialInfo = getMaterialInfo(); 

                // This should be enabled uncommented when fixed in the browsers
                // @see https://github.com/gpuweb/gpuweb/issues/3479
                // ${flags.isMask ? /* wgsl */`
                //     if (materialInfo.baseColor.a < material.alphaCutoff) {
                //         discard;
                //     }
                // ` : ''} 

                ${flags.hasExtension?.KHR_materials_unlit ? /* wgsl */`
                    out.color = vec4<f32>(linearTosRGB(materialInfo.baseColor.rgb), materialInfo.baseColor.a);
                ` : /* wgsl */`
                    lightInfo  = getLightInfo();
                    
                    ${flags.useEnvironment ? /* wgsl */`applyEnvironment();`: ''}
                    applyOcclusion(in.gl_FragCoord.xy);
                    ${flags.usePunctual ? /* wgsl */`applyPunctual();`: ''} // this is really slow in webgpu (check sponza zoomed in)
                    ${flags.useTransmission ? /* wgsl */`applyTransmission();`: ''}

                    out.color = applyLighting();

                    ${!flags.useLinear ? /* wgsl */`
                        out.color = vec4<f32>(linearTosRGB(applyToneMap(out.color.rgb)), out.color.a);
                    `: ''}

                    ${flags.useFog ? /* wgsl */`
                        var dist = getLinearDepth(in.gl_FragCoord.z);
                        var fog = (settings.fog.range.y - dist) / (settings.fog.range.x - settings.fog.range.y);
                        fog = clamp(fog, 0.0, 1.0);
                        out.color = mix(out.color, settings.fog.color, fog);
                    `: ''}

                    ${flags.debug?.pbr?.enabled ? /* wgsl */`
                        ${PBR_DEBUG_MODES[flags.debug.pbr.mode]?.wgsl || ''}
                    `: ''}
                `}

                ${flags.storePointInfo ? /* wgsl */`
                    out.pointInfo = vec4<f32>(in.gl_FragCoord.z, normalize((mat3x3<f32>(frustum.viewMatrix[0].xyz, frustum.viewMatrix[1].xyz, frustum.viewMatrix[2].xyz) * normalInfo.n * 0.5) + 0.5));
                `: ''}

                return out;
            }
        `;
    } else {
        fragment = /* wgsl */`
            struct FragmentOutput {
                @location(0) color: vec4<f32>,
            };

            struct FragmentInput {
                @builtin(position) gl_FragCoord: vec4<f32>,
                @location(0) position: vec3<f32>,

                @location(1) texCoord0: vec2<f32>,
                @location(2) texCoord1: vec2<f32>,

                ${flags.hasAttr['COLOR_0'] ? /* wgsl */`@location(3) color0: ${color0Type}<f32>,` : ''}

                ${flags.hasAttr['NORMAL'] ? /* wgsl */`
                @location(4) normal: vec3<f32>,
                ${flags.hasAttr['TANGENT'] ? /* wgsl */`
                @location(5) tangent: vec3<f32>,
                @location(6) bitangent: vec3<f32>,
                ` : ''}
                ` : ''}
                @location(7) modelScale: vec3<f32>,

                @builtin(front_facing) frontFacing: bool,
            };
            
            @fragment
            fn main(in: FragmentInput) -> FragmentOutput {
                var out: FragmentOutput;

                out.color = vec4<f32>(vec3<f32>(in.gl_FragCoord.z * 0.5 + 0.5), 1.0);

                return out;
            }
        `;
    }

    return { vertex, fragment };
}

export default generate;