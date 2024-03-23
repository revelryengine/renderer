import { PBR_DEBUG_MODES } from '../../../../../constants.js';
import { Frustum         } from '../../../../../frustum.js';

import generateFormulasBlock from '../formulas.glsl.js';
import generateVertexBlock   from './vertex.glsl.js';
import generateLightingBlock from './lighting.glsl.js';
import generateMaterialBlock from './material.glsl.js';

const formulasBlock        = generateFormulasBlock();

const frustumUniformBlock  = Frustum.generateUniformBlock('glsl', 1, 0);

/**
 * @param {import('../../shader.js').ShaderInitialized<import('../../gltf-shader.js').GLTFShader>} shader
 */
export function generate(shader) {
    const { flags, input: { renderNode: { settings } } } = shader;

    const color0Type = flags.hasColor0Vec4 ? 'vec4': 'vec3';

    const vertex = generateVertexBlock(shader);
    const settingsUniformBlock = settings.generateUniformBlock(0, 0);

    const lightingMode = {
        unlit: /* glsl */`
            g_finalColor = vec4(linearTosRGB(materialInfo.baseColor.rgb), materialInfo.baseColor.a);
        `,
        solid: /* glsl */`
            vec3 c = mix(material.baseColorFactor.rgb, material.baseColorFactor.rgb * dot(normalInfo.n, normalInfo.v), vec3(settings.depthHint.factor));
            g_finalColor = vec4(linearTosRGB(c), 1.0);
        `,
        preview: /* glsl */`
            vec3 c = mix(materialInfo.baseColor.rgb, materialInfo.baseColor.rgb * dot(normalInfo.n, normalInfo.v),  vec3(settings.depthHint.factor));
            g_finalColor = vec4(linearTosRGB(c), materialInfo.baseColor.a);
        `,
        wireframe: /* glsl */`
            if(edgeFactor(v_barycentric, settings.wireframe.width) < 1.0) {
                discard;
            }

            g_finalColor = settings.wireframe.color;
            g_finalColor.a *= (1.0 - float(!gl_FrontFacing) * 0.25);
        `,
        standard: /* glsl */`
            lightInfo  = getLightInfo();

            ${flags.useEnvironment ? /* glsl */`applyEnvironment();`: ''}
            applyOcclusion(gl_FragCoord.xy);
            ${flags.usePunctual ? /* glsl */`applyPunctual();`: ''}
            ${flags.useTransmission ? /* glsl */`applyTransmission();`: ''}

            g_finalColor = applyLighting();

            ${!flags.useLinear ? /* glsl */`
                g_finalColor = vec4(linearTosRGB(applyToneMap(g_finalColor.rgb, settings.exposure)), g_finalColor.a);
            `: ''}

            ${flags.useFog ? /* glsl */`
                float dist = getLinearDepth(gl_FragCoord.z);
                float fog = (settings.fog.range.y - dist) / (settings.fog.range.x - settings.fog.range.y);
                fog = clamp(fog, 0.0, 1.0);
                g_finalColor = mix(g_finalColor, settings.fog.color, fog);
            `: ''}
        `,
    }

    const fragment = /* glsl */`#version 300 es
        precision highp float;

        ${settingsUniformBlock}
        ${frustumUniformBlock}

        in vec3 v_position;
        in vec4 v_texCoord;

        // we compact normal, tangent, bitangent, and scale into these 3 varyings
        in vec4 v_modelInfo0;
        in vec4 v_modelInfo1;
        in vec4 v_modelInfo2;

        ${flags.hasAttr['COLOR_0'] ? /* glsl */`in ${color0Type} v_color0;` : ''}

        ${flags.useShadows ? /* glsl */`
        in vec4 v_shadowTexcoords[6];
        ` : ''}

        ${flags.colorTargets.motion ? /* glsl */`
        in vec4 v_motionPosition;
        in vec4 v_motionPositionPrev;
        `: ''}

        ${flags.colorTargets.id || flags.useHighlight ? /* glsl */`
        flat in highp uint v_graphId;
        `: ''}

        ${flags.useBarycentric ? /* glsl */`
        in vec3 v_barycentric;
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

        float edgeFactor(vec3 vbc, float width) {
            vec3 d = fwidth(vbc);
            vec3 f = step(d * width, vbc);
            return 1.0 - min(min(f.x, f.y), f.z);
        }

        ${generateMaterialBlock(shader)}
        ${flags.lighting === 'standard' || flags.lighting === 'preview' ? generateLightingBlock(shader) : ''}

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

            materialInfo = getMaterialInfo();

            ${flags.isMask ? /* glsl */`
                if (materialInfo.baseColor.a < material.alphaCutoff) {
                    discard;
                }
            ` : ''}

            ${flags.colorTargets.color ? /* glsl */`
                ${lightingMode[flags.lighting] ?? lightingMode['standard']}

                ${flags.colorTargets.blend && flags.writeMasks.blend ? /* glsl */`
                    /** @see https://learnopengl.com/Guest-Articles/2020/OIT/Weighted-Blended */
                    float weight = alphaWeight(gl_FragCoord.z, g_finalColor.a);

                    g_finalAccum  = vec4(g_finalColor.rgb * g_finalColor.a, g_finalColor.a) * weight;
                    g_finalReveal = g_finalColor.a;
                `: ''}

                ${flags.debugPBR && flags.debugPBR !== 'None' ? /* glsl */`
                    ${PBR_DEBUG_MODES[flags.debugPBR]?.glsl ?? ''}
                `: ''}
            ` : ''}
        }
    `;

    return { vertex, fragment };
}

export default generate;
