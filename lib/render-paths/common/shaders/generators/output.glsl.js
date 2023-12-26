import { Frustum } from '../../../../frustum.js';

const frustumUniformBlock  = Frustum.generateUniformBlock('glsl', 0, 0);

export function generate() {
    const vertex =  /* glsl */`#version 300 es
        precision highp float;
        precision highp int;

        ${frustumUniformBlock}

        #pragma revTextureBinding(colorTexture, 1, 1, 0)
        uniform sampler2D colorTexture;

        out vec2 texCoord;

        void main(void) { //[0, 0] [4, 0] [0, 4] -> [0, 0] [2, 0] [0, 2]
            int id  = gl_VertexID % 3;
            float x = float((id & 1) << 2);
            float y = float((id & 2) << 1);
            vec2 size = vec2(textureSize(colorTexture, 0));

            texCoord = vec2(x * 0.5, y * 0.5) * (vec2(frustum.width, frustum.height) / size);

            // Y is flipped because it assumes we have output the colorTexture in y-down coordinates. This matches the WebGPU implementation.
            gl_Position = vec4(x - 1.0, 1.0 - y, 1.0, 1.0);
        }
    `;


    const fragment = /* glsl */`#version 300 es
        precision highp float;
        precision highp int;

        #pragma revTextureBinding(colorTexture, 1, 1, 0)
        uniform sampler2D colorTexture;

        in vec2 texCoord;

        layout(location=0) out vec4 g_finalColor;

        void main(void) {
            // Y is flipped because it assumes we have output the colorTexture in y-down coordinates.
            g_finalColor = texture(colorTexture, vec2(texCoord.x, 1.0 - texCoord.y));
        }

    `;

    return { vertex, fragment };
}

export default generate;
