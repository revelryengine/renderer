import fullscreenVert from './fullscreen.vert.glsl.js';

export function generate() {
    const vertex = fullscreenVert();

    const fragment = /* glsl */`#version 300 es
        precision highp float;

        in vec2 texCoord;
        flat in int texLayer;

        layout(location=0) out vec4 g_finalColor;

        void main(void) {
            g_finalColor = vec4(texCoord.x, texCoord.y, float(texLayer), 1.0);
        }
    `;

    return { vertex, fragment };
}

export default generate;
