import { PBR_DEBUG_MODES } from '../../../../../constants.js';
import { Frustum         } from '../../../../../frustum.js';

import generateFormulasBlock from '../formulas.wgsl.js';
import generateVertexBlock   from './vertex.wgsl.js';
import generateLightingBlock from './lighting.wgsl.js';
import generateMaterialBlock from './material.wgsl.js';

const formulasBlock        = generateFormulasBlock();
const frustumUniformBlock  = Frustum.generateUniformBlock('wgsl',  1, 0);

export function generate({ flags, locations, input: { settings } }) {
    const color0Type   = flags.hasColor0Vec4   ? 'vec4': 'vec3';

    const vertex = generateVertexBlock({ flags, locations });
    const settingsUniformBlock = settings.generateUniformBlock(0, 0);

    const lightingMode = {
        unlit: /* wgsl */`
            out.color = vec4<f32>(linearTosRGB(materialInfo.baseColor.rgb), materialInfo.baseColor.a);
        `,
        solid: /* wgsl */`
            var c = mix(material.baseColorFactor.rgb, material.baseColorFactor.rgb * dot(normalInfo.n, normalInfo.v), vec3<f32>(settings.depthHint.factor));
            out.color = vec4<f32>(linearTosRGB(c), 1.0);
        `,
        preview: /* wgsl */`
            var c = mix(materialInfo.baseColor.rgb, materialInfo.baseColor.rgb * dot(normalInfo.n, normalInfo.v), vec3<f32>(settings.depthHint.factor));
            out.color = vec4<f32>(linearTosRGB(c), materialInfo.baseColor.a);
        `,
        wireframe: /* wgsl */`
            if(edgeFactor(in.barycentric, settings.wireframe.width) < 1.0) {
                discard;
            }

            out.color = settings.wireframe.color;
            out.color.a *= (1.0 - f32(!in.frontFacing) * 0.25);
        `,
        standard: /* wgsl */`
            lightInfo  = getLightInfo();

            ${flags.useEnvironment ? /* wgsl */`applyEnvironment();`: ''}
            applyOcclusion(in.gl_FragCoord.xy);
            ${flags.usePunctual ? /* wgsl */`applyPunctual();`: ''} // this is really slow in webgpu (check sponza zoomed in)
            ${flags.useTransmission ? /* wgsl */`applyTransmission();`: ''}

            out.color = applyLighting();

            ${!flags.useLinear ? /* wgsl */`
                out.color = vec4<f32>(linearTosRGB(applyToneMap(out.color.rgb, settings.exposure)), out.color.a);
            `: ''}

            ${flags.useFog ? /* wgsl */`
                var dist = getLinearDepth(in.gl_FragCoord.z);
                var fog = (settings.fog.range.y - dist) / (settings.fog.range.x - settings.fog.range.y);
                fog = clamp(fog, 0.0, 1.0);
                out.color = mix(out.color, settings.fog.color, fog);
            `: ''}
        `,
    }

    const fragment = /* wgsl */`
        ${settingsUniformBlock}
        ${frustumUniformBlock}

        struct FragmentInput {
            @builtin(position) gl_FragCoord: vec4<f32>,

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

            @builtin(front_facing) frontFacing: bool,
        };

        var<private> in: FragmentInput;



        ${flags.useShadows ? /* wgsl */`
        var<private> shadowTexcoords : array<vec4<f32>, 6>;
        ` : ''}

        struct FragmentOutput {
            @location(0) color: vec4<f32>,
            @location(1) accum: vec4<f32>,
            @location(2) reveal: f32,
            @location(3) pointInfo: vec4<f32>,
            @location(4) pointId: u32,
            @location(5) motionVector: vec2<f32>,
        };

        ${formulasBlock}

        fn getLinearDepth(d: f32) -> f32 {
            return frustum.near * frustum.far / (frustum.far + d * (frustum.near - frustum.far));
        }

        fn alphaWeight(z: f32, a: f32) -> f32 {
            var d = ((frustum.near * frustum.far) / (z - frustum.far)) / (frustum.near - frustum.far);
            return a * max(1e-2, 3e3 * pow(1.0 - d, 3.0));
        }

        fn edgeFactor(vbc: vec3<f32>, width: f32) -> f32 {
            var d = fwidth(vbc);
            var f = step(d * width, vbc);
            return 1.0 - min(min(f.x, f.y), f.z);
        }

        ${generateMaterialBlock({ flags, locations })}
        ${flags.lighting === 'standard' || flags.lighting === 'preview' ? generateLightingBlock({ flags, locations }) : ''}

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

            ${flags.colorTargets.color || flags.colorTargets.point ? /* wgsl */`
                normalInfo = getNormalInfo();
            ` : ''}

            ${flags.colorTargets.point ? /* wgsl */`
                out.pointInfo  = vec4<f32>(in.gl_FragCoord.z, normalize(mat3x3<f32>(frustum.viewMatrix[0].xyz, frustum.viewMatrix[1].xyz, frustum.viewMatrix[2].xyz) * normalInfo.n * 0.5 + 0.5));
            `: ''}

            ${flags.colorTargets.id ? /* wgsl */`
                out.pointId = in.graphId;
            `: ''}

            ${flags.colorTargets.motion ? /* wgsl */`
                var a = (in.motionPosition.xy / in.motionPosition.w) * 0.5 + 0.5;
                var b = (in.motionPositionPrev.xy / in.motionPositionPrev.w) * 0.5 + 0.5;
                out.motionVector = a - b;
            `: ''}

            materialInfo = getMaterialInfo();

            ${flags.isMask ? /* wgsl */`
                if (materialInfo.baseColor.a < material.alphaCutoff) {
                    discard;
                }
            ` : ''}

            ${flags.colorTargets.color ? /* wgsl */`
                ${lightingMode[flags.lighting] ?? lightingMode['standard']}

                ${flags.colorTargets.blend && flags.writeMasks.blend ? /* wgsl */`
                    /** @see https://learnopengl.com/Guest-Articles/2020/OIT/Weighted-Blended */
                    var weight = alphaWeight(in.gl_FragCoord.z, out.color.a);

                    out.accum  = vec4<f32>(out.color.rgb * out.color.a, out.color.a) * weight;
                    out.reveal = out.color.a;
                `: ''}

                ${flags.debugPBR && flags.debugPBR !== 'None'? /* wgsl */`
                    ${PBR_DEBUG_MODES[flags.debugPBR]?.wgsl ?? ''}
                `: ''}
            `: ''}

            return out;
        }
    `;

    return { vertex, fragment };
}

export default generate;
