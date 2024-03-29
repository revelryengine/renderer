import { roundUp } from '../../../../../../deps/utils.js';

/**
 * @param {import('../../shader.js').ShaderInitialized<import('../../gltf-shader.js').GLTFShader>} shader
 */
export function generate({ flags, locations }) {
    const morphCount  = flags.morphCount ?? 0;
    const weightCount = roundUp(16, morphCount); //padded to 16 for simplicity in texture layout

    const code = /* glsl */`
        #pragma revTextureBinding(modelTexture, 0, 1)
        uniform sampler2DArray modelTexture;

        #pragma revTextureBinding(jointTexture, 0, 2)
        uniform sampler2DArray jointTexture;

        #pragma revTextureBinding(morphTexture, 0, 3)
        uniform sampler2DArray morphTexture;

        ${flags.colorTargets.motion ? /* glsl */`
        #pragma revTextureBinding(modelTextureHistory, 0, 4)
        uniform sampler2DArray modelTextureHistory;

        #pragma revTextureBinding(jointTextureHistory, 0, 5)
        uniform sampler2DArray jointTextureHistory;

        #pragma revTextureBinding(morphTextureHistory, 0, 6)
        uniform sampler2DArray morphTextureHistory;
        `: ''}

        #pragma revTextureBinding(targetTexture, 3, ${locations.target})
        uniform sampler2DArray targetTexture;

        struct ModelInfo {
            mat4 matrix;
            mat4 normalMatrix;

            ${flags.hasAttr['JOINTS_0'] || flags.hasAttr['JOINTS_1'] ? /* glsl */`
                mat4 skinMatrix;
                mat3 skinNormalMatrix;
            `: ''}

            ${weightCount ? /* glsl */`
                float weights[${weightCount}];
            `: ''}

            vec4 position;
        };

        mat4 readMatrix(sampler2DArray tex, highp uint i) {
            vec2 size = vec2(textureSize(tex, 0));

            float index  = float(i) * 4.0;

            int x = int(mod(index, size.x));
            int y = int(mod(floor(index / size.x), size.y));
            int z = int(floor(index / (size.x * size.y)));

            return mat4(
                texelFetch(tex, ivec3(x + 0, y, z), 0),
                texelFetch(tex, ivec3(x + 1, y, z), 0),
                texelFetch(tex, ivec3(x + 2, y, z), 0),
                texelFetch(tex, ivec3(x + 3, y, z), 0)
            );
        }

        ${weightCount ? /* glsl */`
        float[${weightCount}] readWeights(sampler2DArray tex, highp uint i) {
            float weights[${weightCount}];

            for(uint j = 0u; j < ${weightCount / 16}u; j = j + 1u) {
                mat4 texels = readMatrix(tex, i + j);
                for(uint r = 0u; r < 4u; r = r + 1u) {
                    for(uint c = 0u; c < 4u; c = c + 1u) {
                        weights[(j * 16u) + (c * 4u) + r] = texels[c][r];
                    }
                }
            }
            return weights;
        }
        `: ''}


        mat4 getSkinningMatrix(sampler2DArray tex, highp uint jointIndex) {
            mat4 skin = mat4(0);

            ${flags.hasAttr['WEIGHTS_0'] && flags.hasAttr['JOINTS_0']? /* glsl */`
                skin +=
                    a_weights0.x * readMatrix(tex, jointIndex + (a_joints0.x * 2u)) +
                    a_weights0.y * readMatrix(tex, jointIndex + (a_joints0.y * 2u)) +
                    a_weights0.z * readMatrix(tex, jointIndex + (a_joints0.z * 2u)) +
                    a_weights0.w * readMatrix(tex, jointIndex + (a_joints0.w * 2u));
            `: ''}

            ${flags.hasAttr['WEIGHTS_1'] && flags.hasAttr['JOINTS_1'] ? /* glsl */`
                skin +=
                    a_weights1.x * readMatrix(tex, jointIndex + (a_joints1.x * 2u)) +
                    a_weights1.y * readMatrix(tex, jointIndex + (a_joints1.y * 2u)) +
                    a_weights1.z * readMatrix(tex, jointIndex + (a_joints1.z * 2u)) +
                    a_weights1.w * readMatrix(tex, jointIndex + (a_joints1.w * 2u));
            `: ''}

            return skin;
        }

        mat3 getSkinningNormalMatrix(sampler2DArray tex, uint jointIndex) {
            mat4 skin = getSkinningMatrix(tex, jointIndex);
            return mat3(
                skin[0].xyz,
                skin[1].xyz,
                skin[2].xyz
            );
        }

        vec4 getDisplacement(sampler2DArray tex, int i, int z, int width) {
            int x = i % width;
            int y = (i - x) / width;
            return texelFetch(tex, ivec3(x, y, z), 0);
        }

        ${flags.hasTarget?.['POSITION'] ? /* glsl */`
        vec4 getTargetPosition(ModelInfo modelInfo, int vertexID) {
            vec4 result  = vec4(0);
            int width = textureSize(targetTexture, 0).x;

            for(int i = 0; i < ${morphCount}; i++) {
                vec4 displacement = getDisplacement(targetTexture, vertexID, ${locations.targets.POSITION * morphCount} + i, width);
                result = result + modelInfo.weights[i] * displacement;
            }
            return result;
        }
        `: ''}

        vec4 getPosition(ModelInfo modelInfo) {
            vec4 pos = vec4(a_position.xyz, 1.0);

            ${flags.hasTarget?.['POSITION'] ? /* glsl */`
                pos = getTargetPosition(modelInfo, gl_VertexID) + pos;
            `: ''}

            ${flags.hasAttr['JOINTS_0'] || flags.hasAttr['JOINTS_1'] ? /* glsl */`
                pos = modelInfo.skinMatrix * pos;
            `: ''}

            return pos;
        }

        ${flags.hasAttr['NORMAL'] ? /* glsl */`
            ${flags.hasTarget?.['NORMAL'] ? /* glsl */`
            vec3 getTargetNormal(ModelInfo modelInfo, int vertexID) {
                vec3 result  = vec3(0);
                int width = textureSize(targetTexture, 0).x;

                for(int i = 0; i < ${morphCount}; i++) {
                    vec4 displacement = getDisplacement(targetTexture, vertexID, ${locations.targets.NORMAL * morphCount} + i, width);
                    result = result + modelInfo.weights[i] * displacement.xyz;
                }
                return result;
            }
            `: ''}

            vec3 getNormal(ModelInfo modelInfo) {
                vec3 normal = a_normal.xyz;

                ${flags.hasTarget?.['NORMAL'] ? /* glsl */`
                normal = getTargetNormal(modelInfo, gl_VertexID) + normal;
                `: ''}

                ${flags.hasAttr['JOINTS_0'] || flags.hasAttr['JOINTS_1'] ? /* glsl */`
                normal = modelInfo.skinNormalMatrix * normal;
                `: ''}

                return normalize(normal);
            }
        `: ''}

        ${flags.hasAttr['TANGENT'] ? /* glsl */`
            ${flags.hasTarget?.['TANGENT'] ? /* glsl */`
            vec3 getTargetTangent(ModelInfo modelInfo, int vertexID) {
                vec3 result  = vec3(0);
                int width = textureSize(targetTexture, 0).x;

                for(int i = 0; i < ${morphCount}; i++) {
                    vec4 displacement = getDisplacement(targetTexture, vertexID, ${locations.targets.TANGENT * morphCount} + i, width);
                    result = result + modelInfo.weights[i] * displacement.xyz;
                }
                return result;
            }
            `: ''}

            vec3 getTangent(ModelInfo modelInfo) {
                vec3 tangent = a_tangent.xyz;

                ${flags.hasTarget?.['TANGENT'] ? /* glsl */`
                tangent = getTargetTangent(modelInfo, gl_VertexID) + tangent;
                `: ''}

                ${flags.hasAttr['JOINTS_0'] || flags.hasAttr['JOINTS_1'] ? /* glsl */`
                tangent = mat3(modelInfo.skinMatrix) * tangent;
                `: ''}

                return tangent;
            }
        `: ''}

        ${flags.hasAttr['TEXCOORD_0'] ? /* glsl */`
            ${flags.hasTarget?.['TEXCOORD_0'] ? /* glsl */`
            vec2 getTargetTexCoord0(ModelInfo modelInfo, int vertexID) {
                vec2 result = vec2(0.0);
                int width = textureSize(targetTexture, 0).x;

                for(int i = 0; i < ${morphCount}; i = i + 1) {
                    vec4 displacement = getDisplacement(targetTexture, vertexID, ${locations.targets.TEXCOORD_0 * morphCount} + i, width);
                    result = result + modelInfo.weights[i] * displacement.xy;
                }

                return result;
            }
            `: '' }

            vec2 getTexCoord0(ModelInfo modelInfo) {
                vec2 texCoord = a_texCoord0;

                ${flags.hasTarget?.['TEXCOORD_0'] ? /* glsl */`
                texCoord = getTargetTexCoord0(modelInfo, gl_VertexID) + texCoord;
                `: ''}

                return texCoord;
            }
        `: ''}

        ${flags.hasAttr['TEXCOORD_1'] ? /* glsl */`
            ${flags.hasTarget?.['TEXCOORD_1'] ? /* glsl */`
            vec2 getTargetTexCoord1(ModelInfo modelInfo, int vertexID) {
                vec2 result = vec2(0.0);
                int width = textureSize(targetTexture, 0).x;

                for(int i = 0; i < ${morphCount}; i = i + 1) {
                    vec4 displacement = getDisplacement(targetTexture, vertexID, ${locations.targets.TEXCOORD_0 * morphCount} + i, width);
                    result = result + modelInfo.weights[i] * displacement.xy;
                }

                return result;
            }
            `: '' }

            vec2 getTexCoord1(ModelInfo modelInfo) {
                vec2 texCoord = a_texCoord1;

                ${flags.hasTarget?.['TEXCOORD_1'] ? /* glsl */`
                texCoord = getTargetTexCoord1(modelInfo, gl_VertexID) + texCoord;
                `: ''}

                return texCoord;
            }
        `: ''}


        ModelInfo getModelInfo(uvec4 graph) {
            ModelInfo modelInfo;
            modelInfo.matrix       = readMatrix(modelTexture, graph.x);
            modelInfo.normalMatrix = readMatrix(modelTexture, graph.x + 1u);

            ${flags.hasAttr['JOINTS_0'] || flags.hasAttr['JOINTS_1'] ? /* glsl */`
                modelInfo.skinMatrix       = getSkinningMatrix(jointTexture, graph.y);
                modelInfo.skinNormalMatrix = getSkinningNormalMatrix(jointTexture, graph.y + 1u);
            `: ''}

            ${weightCount ? /* glsl */`
                modelInfo.weights = readWeights(morphTexture, graph.z);
            `: ''}

            modelInfo.position = modelInfo.matrix * getPosition(modelInfo);
            return modelInfo;
        }

        ${flags.colorTargets.motion ? /* glsl */`
        ModelInfo getModelInfoHistory(uvec4 graph) {
            ModelInfo modelInfo;
            modelInfo.matrix = readMatrix(modelTextureHistory, graph.x);

            ${flags.hasAttr['JOINTS_0'] || flags.hasAttr['JOINTS_1'] ? /* glsl */`
                modelInfo.skinMatrix = getSkinningMatrix(jointTextureHistory, graph.y);
            `: ''}

            ${weightCount ? /* glsl */`
                modelInfo.weights = readWeights(morphTextureHistory, graph.z);
            `: ''}

            modelInfo.position = modelInfo.matrix * getPosition(modelInfo);
            return modelInfo;
        }
        `: ''}

    `;


    return code;
}

export default generate;
