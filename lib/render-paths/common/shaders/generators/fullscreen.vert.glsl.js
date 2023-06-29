export function generate() {
    const code = /* glsl */`#version 300 es
        precision highp float;
        precision highp int;
        
        out vec2 texCoord;
        flat out int texLayer;

        void main(void) {
            int id  = gl_VertexID % 3;
            float x = float((id & 1) << 2);
            float y = float((id & 2) << 1);

            texCoord = vec2(x * 0.5, y * 0.5);
            texLayer = int((gl_VertexID - (gl_VertexID % 3)) / 3);

            gl_Position = vec4(x - 1.0, y - 1.0, 1.0, 1.0);
        }
    `;
    
    return code;
}

export default generate;