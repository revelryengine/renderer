import fullscreenVert from './fullscreen.vert.glsl.js';

import { Gaussian } from '../gaussian-shader.js';

/**
 * References:
 *
 * @see https://stackoverflow.com/questions/6538310/anyone-know-where-i-can-find-a-glsl-implementation-of-a-bilateral-filter-blur/6538650
 * @see https://www.gamasutra.com/blogs/PeterWester/20140116/208742/Generating_smooth_and_cheap_SSAO_using_Temporal_Blur.php
 * @see https://github.com/mattdesl/lwjgl-basics/wiki/ShaderLesson5
 * @see https://rastergrid.com/blog/2010/09/efficient-gaussian-blur-with-linear-sampling/
 */

/**
 * Pascals Triangle Rows 8, 12, and 16, with 2 outermost coefficents dropped
 * 28 56 70 56 28                                                     238
 * 66 220 495 792 924 792 495 220 66                                  4070
 * 120 560 1820 4368 8008 11440 12870 11440 8008 4368 1820 560 120    65502
 */

/**
 * @param {import('../shader.js').ShaderInitialized<import('../gaussian-shader.js').GaussianShader>} shader
 */
export function generate({ flags: { bilateral } }) {
    const vertex = fullscreenVert();

    const fragment = /* glsl */`#version 300 es
        precision highp float;

        #pragma revTextureBinding(colorTexture, 0, 1, 0)
        uniform sampler2D colorTexture;

        ${Gaussian.generateUniformBlock('glsl', 0, 2)}

        in vec2 texCoord;
        out vec4 g_finalColor;

        /* 9 Tap */
        const int sampleCount = 3;
        const float colorSamples[3]  = float[](0.0, 1.3846153846, 3.2307692308);
        const float gaussianCoeff[3] = float[](0.2270270270, 0.3162162162, 0.0702702703);

        void main(void) {
            vec2 texelSize = 1.0 / vec2(textureSize(colorTexture, 0));

            vec2 offsetScale = gaussian.direction * texelSize;

            ${bilateral ? /* glsl */`
                /**
                 * I have no idea if this is right but it does look slightly better.
                 * The closeness function is currently base on color distance at the moment.
                 * This is because I am trying to make SSAO tighter after the blur and reduce halo artifacts.
                 */
                vec4 centerColor = texture(colorTexture, texCoord);
                vec4 result = centerColor * 2.0 * gaussianCoeff[0];
                float normalization = 2.0 * gaussianCoeff[0];
                for (int i = 1; i < sampleCount; i++) {
                    vec2 offset = colorSamples[i] * offsetScale;
                    vec4 a = texture(colorTexture, texCoord + offset);
                    vec4 b = texture(colorTexture, texCoord - offset);
                    float aCloseness = 1.0 - distance(a, centerColor) / length(vec4(1.0));
                    float bCloseness = 1.0 - distance(b, centerColor) / length(vec4(1.0));
                    float aWeight = gaussianCoeff[i] * aCloseness;
                    float bWeight = gaussianCoeff[i] * bCloseness;
                    result = result + (a * aWeight);
                    result = result + (b * bWeight);
                    normalization = normalization + (aWeight + bWeight);
                }
                g_finalColor = result / normalization;
            `: /* glsl */`
                g_finalColor = texture(colorTexture, texCoord) * gaussianCoeff[0];
                for (int i = 1; i < sampleCount; i++) {
                    vec2 offset = offsetScale * colorSamples[i];
                    g_finalColor = g_finalColor + texture(colorTexture, texCoord + offset) * gaussianCoeff[i];
                    g_finalColor = g_finalColor + texture(colorTexture, texCoord - offset) * gaussianCoeff[i];

                }
            `}
        }
    `;

    return { vertex, fragment };
}

export default generate;
