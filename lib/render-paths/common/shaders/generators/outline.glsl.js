import fullscreenVert from './fullscreen.vert.glsl.js';

export function generate() {
    const vertex = fullscreenVert();

    const fragment = /* glsl */`#version 300 es
        precision highp float;
        precision highp int;

        precision highp sampler2DArray;
        precision highp usampler2D;

        #pragma revTextureBinding(gameObjectTexture, 0, 7)
        uniform sampler2DArray gameObjectTexture;

        #pragma revTextureBinding(idTexture, 1, 1, 0)
        uniform usampler2D idTexture;

        in vec2 texCoord;

        layout(location=0) out vec4 g_finalColor;

        vec4 readInfo(sampler2DArray tex, uint i) {
            vec2 size = vec2(textureSize(tex, 0));
        
            float index  = float(i);
        
            int x = int(mod(index, size.x));
            int y = int(mod(floor(index / size.x), size.y));
            int z = int(floor(index / (size.x * size.y)));

            return texelFetch(tex, ivec3(x, y, z), 0);
        }


        bool edge(uint center, int width, ivec2 texCoord) {
            vec2 size = vec2(textureSize(idTexture, 0));
            
            uint t = texelFetch(idTexture, texCoord + ivec2( 0,-1) * width, 0).r;
            uint b = texelFetch(idTexture, texCoord + ivec2( 0, 1) * width, 0).r;
            uint l = texelFetch(idTexture, texCoord + ivec2(-1, 0) * width, 0).r;
            uint r = texelFetch(idTexture, texCoord + ivec2( 1, 0) * width, 0).r;

            uint tl = texelFetch(idTexture, texCoord + ivec2(-1,-1) * width, 0).r;
            uint tr = texelFetch(idTexture, texCoord + ivec2( 1,-1) * width, 0).r;
            uint bl = texelFetch(idTexture, texCoord + ivec2(-1, 1) * width, 0).r;
            uint br = texelFetch(idTexture, texCoord + ivec2( 1, 1) * width, 0).r;

            float sum = float(t != center) + float(b != center) + float(l != center) + float(r != center) +
                        float(tl != center) + float(tr != center) + float(bl != center) + float(br != center);

            return sum > 0.0;
        }
            
        void main(void) {
            uint id = texelFetch(idTexture, ivec2(gl_FragCoord.xy), 0).r;
            if(!edge(id, 1, ivec2(gl_FragCoord.xy))){
                discard;
            }
            g_finalColor = readInfo(gameObjectTexture, id);
        }

    `;
    
    return { vertex, fragment };
}

export default generate;