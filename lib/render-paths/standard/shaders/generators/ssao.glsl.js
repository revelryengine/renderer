import fullscreenVert       from '../../../common/shaders/generators/fullscreen.vert.glsl.js';

import { Frustum  } from '../../../../frustum.js';

const frustumUniformBlock  = Frustum.generateUniformBlock('glsl', 1, 0);

/**
 * References:
 *
 * @see https://learnopengl.com/Advanced-Lighting/SSAO
 * @see https://mynameismjp.wordpress.com/2010/09/05/position-from-depth-3/
 * @see https://www.derschmale.com/2014/01/26/reconstructing-positions-from-the-depth-buffer/
 * @see https://www.khronos.org/opengl/wiki/Compute_eye_space_from_window_space
 */

/**
 * @param {import('../../../common/shaders/shader.js').ShaderInitialized<import('../ssao-shader.js').SSAOShader>} shader
 */
export function generate({ input: { buffer, size, settings } }) {
    const vertex = fullscreenVert();

    const settingsUniformBlock = settings.generateUniformBlock(0, 0);

    const fragment = /* glsl */`#version 300 es
        precision highp float;
        precision highp sampler2D;

        ${settingsUniformBlock}
        ${frustumUniformBlock}

        #pragma revTextureBinding(pointTexture, 2, 1, 0)
        uniform sampler2D pointTexture; //contains z and normal

        #pragma revTextureBinding(noiseTexture, 2, 3, 2)
        uniform sampler2D noiseTexture;

        ${buffer.generateUniformBlock(2, 4)}

        const vec2 noiseScale = vec2(${size.width.toFixed(1)}, ${size.height.toFixed(1)});

        in vec2 texCoord;

        layout(location=0) out vec4 g_finalColor;

        vec3 getPosFromDepth(vec2 coord, float depth) {
            vec4 clip = frustum.invProjectionMatrix * vec4(vec3(coord, depth) * 2.0 - 1.0, 1.0);
            return clip.xyz / clip.w;
        }

        float getOffsetDepth(vec2 coord) {
            float depth = texture(pointTexture, coord).x;
            return getPosFromDepth(coord, depth).z;
        }

        void main(void) {
            vec4 pointInfo = texture(pointTexture, texCoord);
            vec3 fragPos   = getPosFromDepth(texCoord, pointInfo.x);
            vec3 normal    = pointInfo.yzw;
            vec3 randomVec = texture(noiseTexture, texCoord * noiseScale).xyz;
            vec3 tangent   = normalize(randomVec - normal * dot(randomVec, normal));
            vec3 bitangent = cross(normal, tangent);
            mat3 TBN       = mat3(tangent, bitangent, normal);
            float occlusion = 0.0;

            for(int i = 0; i < ${buffer.kernel.length}; i++) {
                // get sample position
                vec3 samplePos = TBN * ssaouniform.kernel[i]; // from tangent to view-space
                samplePos = fragPos + samplePos * settings.ssao.radius;

                vec4 offset = vec4(samplePos, 1.0);
                offset = frustum.projectionMatrix * offset;    // from view to clip-space

                float sampleDepth = getOffsetDepth((offset.xy / offset.w) * 0.5 + 0.5); // perspective divide and transform to range 0.0 - 1.0
                float rangeCheck  = smoothstep(0.0, 1.0, settings.ssao.radius / abs(fragPos.z - sampleDepth));
                occlusion = occlusion + ((sampleDepth >= samplePos.z + settings.ssao.bias ? 1.0 : 0.0) * rangeCheck);
            }
            occlusion = 1.0 - (occlusion / ${buffer.kernel.length.toFixed(1)});

            g_finalColor = vec4(vec3(occlusion), 1.0);
        }
    `;

    return { vertex, fragment };
}

export default generate;
