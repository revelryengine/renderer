import { roundUp } from '../../../../../../deps/utils.js';

/**
 * @param {import('../../shader.js').ShaderInitialized<import('../../gltf-shader.js').GLTFShader>} shader
 */
export function generate({ flags, locations }) {
    const morphCount  = flags.morphCount ?? 0;
    const weightCount = roundUp(16, morphCount); //padded to 16 for simplicity in texture layout

    const code = /* wgsl */`
        @group(0) @binding(1) var modelTexture: texture_2d_array<f32>;
        @group(0) @binding(2) var jointTexture: texture_2d_array<f32>;
        @group(0) @binding(3) var morphTexture: texture_2d_array<f32>;

        ${flags.colorTargets.motion ? /* wgsl */`
        @group(0) @binding(4) var modelTextureHistory: texture_2d_array<f32>;
        @group(0) @binding(5) var jointTextureHistory: texture_2d_array<f32>;
        @group(0) @binding(6) var morphTextureHistory: texture_2d_array<f32>;
        `: ''}

        @group(3) @binding(${locations.target}) var targetTexture: texture_2d_array<f32>;

        struct ModelInfo {
            matrix:       mat4x4<f32>,
            normalMatrix: mat4x4<f32>,

            ${flags.hasAttr['JOINTS_0'] || flags.hasAttr['JOINTS_1'] ? /* wgsl */`
                skinMatrix:       mat4x4<f32>,
                skinNormalMatrix: mat3x3<f32>,
            `: ''}

            ${weightCount ? /* wgsl */`
                weights: array<f32, ${weightCount}>,
            `: ''}

            position: vec4<f32>,
        };

        fn readMatrix(tex: texture_2d_array<f32>, i: u32) -> mat4x4<f32> {
            var size = vec2<f32>(textureDimensions(tex));

            var index  = f32(i) * 4.0;

            var x = i32((index % size.x));
            var y = i32(floor(index / size.x) % size.y);
            var z = i32(floor(index / (size.x * size.y)));

            return mat4x4<f32>(
                textureLoad(tex, vec2<i32>(x + 0, y), z, 0),
                textureLoad(tex, vec2<i32>(x + 1, y), z, 0),
                textureLoad(tex, vec2<i32>(x + 2, y), z, 0),
                textureLoad(tex, vec2<i32>(x + 3, y), z, 0)
            );
        }

        ${weightCount ? /* wgsl */`
        fn readWeights(tex: texture_2d_array<f32>, i: u32) -> array<f32, ${weightCount}> {
            var weights: array<f32, ${weightCount}>;

            for(var j = 0u; j < ${weightCount / 16}u; j = j + 1u) {
                var texels = readMatrix(tex, i + j);
                for(var r = 0u; r < 4u; r = r + 1u) {
                    for(var c = 0u; c < 4u; c = c + 1u) {
                        weights[(j * 16u) + (c * 4u) + r] = texels[c][r];
                    }
                }
            }
            return weights;
        }
        `: ''}

        fn getSkinningMatrix(tex: texture_2d_array<f32>, jointIndex: u32) -> mat4x4<f32> {
            var skin: mat4x4<f32>;

            ${flags.hasAttr['WEIGHTS_0'] && flags.hasAttr['JOINTS_0']? /* wgsl */`
                skin = skin +
                    in.weights0.x * readMatrix(tex, jointIndex + (in.joints0.x * 2u)) +
                    in.weights0.y * readMatrix(tex, jointIndex + (in.joints0.y * 2u)) +
                    in.weights0.z * readMatrix(tex, jointIndex + (in.joints0.z * 2u)) +
                    in.weights0.w * readMatrix(tex, jointIndex + (in.joints0.w * 2u));
            `: ''}

            ${flags.hasAttr['WEIGHTS_1'] && flags.hasAttr['JOINTS_1'] ? /* wgsl */`
                skin = skin +
                    in.weights1.x * readMatrix(tex, jointIndex + (in.joints1.x * 2u)) +
                    in.weights1.y * readMatrix(tex, jointIndex + (in.joints1.y * 2u)) +
                    in.weights1.z * readMatrix(tex, jointIndex + (in.joints1.z * 2u)) +
                    in.weights1.w * readMatrix(tex, jointIndex + (in.joints1.w * 2u));
            `: ''}

            return skin;
        }

        fn getSkinningNormalMatrix(tex: texture_2d_array<f32>, jointIndex: u32) -> mat3x3<f32> {
            var skin = getSkinningMatrix(tex, jointIndex);
            return mat3x3<f32>(
                skin[0].xyz,
                skin[1].xyz,
                skin[2].xyz
            );
        }

        fn getDisplacement(tex: texture_2d_array<f32>, i: i32, z: i32, width: i32) -> vec4<f32>{
            var x = i % width;
            var y = (i - x) / width;
            return textureLoad(tex, vec2<i32>(x, y), z, 0);
        }

        ${flags.hasTarget?.['POSITION'] ? /* wgsl */`
        fn getTargetPosition(modelInfo: ModelInfo, vertexID: i32) -> vec4<f32> {
            var result = vec4<f32>(0.0);
            var width  = i32(textureDimensions(targetTexture).x);

            var weights = modelInfo.weights; // can't index by non literal so we need to store it as a reference here.
            for(var i = 0; i < ${morphCount}; i = i + 1) {
                var displacement = getDisplacement(targetTexture, vertexID, ${locations.targets.POSITION * morphCount} + i, width);
                result = result + weights[i] * displacement;
            }
            return result;
        }
        `: ''}

        fn getPosition(modelInfo: ModelInfo) -> vec4<f32> {
            var pos = vec4<f32>(in.position.xyz, 1.0);

            ${flags.hasTarget?.['POSITION'] ? /* wgsl */`
                pos = getTargetPosition(modelInfo, i32(in.vertexID)) + pos;
            `: ''}

            ${flags.hasAttr['JOINTS_0'] || flags.hasAttr['JOINTS_1'] ? /* wgsl */`
                pos = modelInfo.skinMatrix * pos;
            `: ''}

            return pos;
        }


        ${flags.hasAttr['NORMAL'] ? /* wgsl */`
            ${flags.hasTarget?.['NORMAL'] ? /* wgsl */`
            fn getTargetNormal(modelInfo: ModelInfo, vertexID: i32) -> vec3<f32> {
                var result = vec3<f32>(0.0);
                var width  = i32(textureDimensions(targetTexture).x);

                var weights = modelInfo.weights; // can't index by non literal so we need to store it as a reference here.
                for(var i = 0; i < ${morphCount}; i = i + 1) {
                    var displacement = getDisplacement(targetTexture, vertexID, ${locations.targets.NORMAL * morphCount} + i, width);
                    result = result + weights[i] * displacement.xyz;
                }
                return result;
            }
            `: ''}

            fn getNormal(modelInfo: ModelInfo) -> vec3<f32> {
                var normal = in.normal.xyz;

                ${flags.hasTarget?.['NORMAL'] ? /* wgsl */`
                normal = getTargetNormal(modelInfo, i32(in.vertexID)) + normal;
                `: ''}

                ${flags.hasAttr['JOINTS_0'] || flags.hasAttr['JOINTS_1'] ? /* wgsl */`
                normal = modelInfo.skinNormalMatrix * normal;
                `: ''}

                return normalize(normal);
            }
        `: ''}

        ${flags.hasAttr['TANGENT'] ? /* wgsl */`
            ${flags.hasTarget?.['TANGENT'] ? /* wgsl */`
            fn getTargetTangent(modelInfo: ModelInfo, vertexID: i32) -> vec3<f32> {
                var result = vec3<f32>(0.0);
                var width  = i32(textureDimensions(targetTexture).x);

                var weights = modelInfo.weights; // can't index by non literal so we need to store it as a reference here.
                for(var i = 0; i < ${morphCount}; i = i + 1) {
                    var displacement = getDisplacement(targetTexture, vertexID, ${locations.targets.TANGENT * morphCount} + i, width);
                    result = result + weights[i] * displacement.xyz;
                }
                return result;
            }
            `: ''}

            fn getTangent(modelInfo: ModelInfo) -> vec3<f32> {
                var tangent = in.tangent.xyz;

                ${flags.hasTarget?.['TANGENT'] ? /* wgsl */`
                tangent = getTargetTangent(modelInfo, i32(in.vertexID)) + tangent;
                `: ''}

                ${flags.hasAttr['JOINTS_0'] || flags.hasAttr['JOINTS_1'] ? /* wgsl */`
                tangent = mat3x3<f32>(modelInfo.skinMatrix[0].xyz, modelInfo.skinMatrix[1].xyz, modelInfo.skinMatrix[2].xyz) * tangent;
                `: ''}

                return tangent;
            }
        `: ''}

        ${flags.hasAttr['TEXCOORD_0'] ? /* wgsl */`
            ${flags.hasTarget?.['TEXCOORD_0'] ? /* wgsl */`
            fn getTargetTexCoord0(modelInfo: ModelInfo, vertexID: i32) -> vec2<f32> {
                var result = vec2<f32>(0.0);
                var width  = i32(textureDimensions(targetTexture).x);

                var weights = modelInfo.weights; // can't index by non literal so we need to store it as a reference here.
                for(var i = 0; i < ${morphCount}; i = i + 1) {
                    var displacement = getDisplacement(targetTexture, vertexID, ${locations.targets.TEXCOORD_0 * morphCount} + i, width);
                    result = result + weights[i] * displacement.xy;
                }

                return result;
            }
            `: '' }

            fn getTexCoord0(modelInfo: ModelInfo) -> vec2<f32> {
                var texCoord = in.texCoord0;

                ${flags.hasTarget?.['TEXCOORD_0'] ? /* wgsl */`
                texCoord = getTargetTexCoord0(modelInfo, i32(in.vertexID)) + texCoord;
                `: ''}

                return texCoord;
            }
        `: ''}

        ${flags.hasAttr['TEXCOORD_1'] ? /* wgsl */`
            ${flags.hasTarget?.['TEXCOORD_1'] ? /* wgsl */`
            fn getTargetTexCoord1(modelInfo: ModelInfo, vertexID: i32) -> vec2<f32> {
                var result = vec2<f32>(0.0);
                var width  = i32(textureDimensions(targetTexture).x);

                var weights = modelInfo.weights; // can't index by non literal so we need to store it as a reference here.
                for(var i = 0; i < ${morphCount}; i = i + 1) {
                    var displacement = getDisplacement(targetTexture, vertexID, ${locations.targets.TEXCOORD_1 * morphCount} + i, width);
                    result = result + weights[i] * displacement.xy;
                }

                return result;
            }
            `: '' }

            fn getTexCoord1(modelInfo: ModelInfo) -> vec2<f32> {
                var texCoord = in.texCoord1;

                ${flags.hasTarget?.['TEXCOORD_1'] ? /* wgsl */`
                texCoord = getTargetTexCoord0(modelInfo, i32(in.vertexID)) + texCoord;
                `: ''}

                return texCoord;
            }
        `: ''}

        fn getModelInfo() -> ModelInfo {
            var modelInfo: ModelInfo;
            modelInfo.matrix       = readMatrix(modelTexture, in.graph.x);
            modelInfo.normalMatrix = readMatrix(modelTexture, in.graph.x + 1u);

            ${flags.hasAttr['JOINTS_0'] || flags.hasAttr['JOINTS_1'] ? /* wgsl */`
                modelInfo.skinMatrix       = getSkinningMatrix(jointTexture, in.graph.y);
                modelInfo.skinNormalMatrix = getSkinningNormalMatrix(jointTexture, in.graph.y + 1u);
            `: ''}

            ${weightCount ? /* wgsl */`
                modelInfo.weights = readWeights(morphTexture, in.graph.z);
            `: ''}

            modelInfo.position = modelInfo.matrix * getPosition(modelInfo);

            return modelInfo;
        }

        ${flags.colorTargets.motion ? /* wgsl */`
        fn getModelInfoHistory() -> ModelInfo {
            var modelInfo: ModelInfo;
            modelInfo.matrix = readMatrix(modelTextureHistory, in.graph.x);

            ${flags.hasAttr['JOINTS_0'] || flags.hasAttr['JOINTS_1'] ? /* wgsl */`
                modelInfo.skinMatrix = getSkinningMatrix(jointTextureHistory, in.graph.y);
            `: ''}

            ${weightCount ? /* wgsl */`
                modelInfo.weights = readWeights(morphTextureHistory, in.graph.z);
            `: ''}

            modelInfo.position = modelInfo.matrix * getPosition(modelInfo);

            return modelInfo;
        }
        `: ''}
    `;

    return code;
}

export default generate;
