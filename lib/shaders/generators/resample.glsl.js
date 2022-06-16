import fullscreenVert from './fullscreen.vert.glsl.js';

export function generate({ flags: { viewDimension = '2d', opaque = false, depth = false } } = {}) {
    const vertex = fullscreenVert();

    const type = depth ? 'depth': viewDimension;

    const samplerTypes = {
        '2d'       : 'sampler2D',
        '2d-array' : 'sampler2DArray',
        'cube'     : 'samplerCube',
        'depth'    : 'sampler2D',
    }

    const resample = {
        '2d'       : /* glsl */`texture(colorTexture, texCoord)`,
        '2d-array' : /* glsl */`texture(colorTexture, vec3(texCoord, texLayer))`,
        'cube'     : /* glsl */`texture(colorTexture, cubeCoord(texCoord * 2.0 - 1.0, texLayer))`,
        'depth'    : /* glsl */`texelFetch(colorTexture, depthCoord(texCoord), texLayer)`,
    }

    const fragment = /* glsl */`#version 300 es
        precision highp float;
        precision highp int;

        ${viewDimension === 'cube' ? /* glsl */`
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
        ` : ''}

        #pragma revTextureBinding(colorTexture, 0, 1, 0)
        uniform ${samplerTypes[type]} colorTexture;

        in vec2 texCoord;
        flat in int texLayer;

        ${type === 'depth' ? /* glsl */`
            ivec2 depthCoord(vec2 uv) {
                vec2 size = vec2(textureSize(colorTexture, 0));
                return ivec2(floor(uv * size));
            }

            void main(void) {
                gl_FragDepth = ${resample[type]}.r;
            }
        `: /* glsl */`
            layout(location=0) out vec4 g_finalColor;
            
            void main(void) {
                g_finalColor = ${resample[type]};
                ${opaque ? /* glsl */`g_finalColor.a = 1.0;`: ''}
            }
        `} 

    `;
    
    return { vertex, fragment };
}

export default generate;