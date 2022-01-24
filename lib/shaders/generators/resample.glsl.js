import fullscreenVert from './fullscreen.vert.glsl.js';

const glsl = String.raw;

export function generate({ flags: { viewDimension = '2d', opaque = false } } = {}) {
    const vertex = fullscreenVert();

    const samplerTypes = {
        '2d'       : 'sampler2D',
        '2d-array' : 'sampler2DArray',
        'cube'     : 'samplerCube',
    }

    const resample = {
        '2d'       : glsl`texture(colorTexture, texCoord);`,
        '2d-array' : glsl`texture(colorTexture, vec3(texCoord, texLayer));`,
        'cube'     : glsl`texture(colorTexture, cubeCoord(texCoord * 2.0 - 1.0, texLayer))`,
    }

    const fragment = glsl`#version 300 es
        precision highp float;
        precision highp int;

        vec3 cubeCoord(vec2 uv, int face) {
            if(face == 0) {
                return normalize(vec3(  1.0, -uv.y, -uv.x));
            } else if(face == 1) {
                return normalize(vec3( -1.0, -uv.y,  uv.x));
            } else if(face == 2) {
                return normalize(vec3( uv.x,   1.0,  uv.y));
            } else if(face == 3) {
                return normalize(vec3( uv.x,  -1.0, -uv.y));
            } else if(face == 4) {
                return normalize(vec3( uv.x, -uv.y,   1.0));
            } else if(face == 5) {
                return normalize(vec3(-uv.x, -uv.y,  -1.0));
            }
            return vec3(0.0);
        }
        
        #pragma revTextureBinding(colorTexture, 0, 1, 0)
        uniform ${samplerTypes[viewDimension]} colorTexture;

        in vec2 texCoord;
        flat in int texLayer;

        layout(location=0) out vec4 g_finalColor;
        
        void main(void) {    
            g_finalColor = ${resample[viewDimension]};
            ${opaque ? glsl`g_finalColor.a = 1.0;`: ''}
        }
    `;
    
    return { vertex, fragment };
}

export default generate;