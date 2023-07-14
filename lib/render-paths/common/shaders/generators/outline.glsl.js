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


        bool edge(uint center, float width) {
            vec2 size = vec2(textureSize(idTexture, 0));
            
            uint t = texture(idTexture, texCoord + vec2( 0,-1) / size * width).r;
            uint b = texture(idTexture, texCoord + vec2( 0, 1) / size * width).r;
            uint l = texture(idTexture, texCoord + vec2(-1, 0) / size * width).r;
            uint r = texture(idTexture, texCoord + vec2( 1, 0) / size * width).r;

            uint tl = texture(idTexture, texCoord + vec2(-1,-1) / size * width).r;
            uint tr = texture(idTexture, texCoord + vec2( 1,-1) / size * width).r;
            uint bl = texture(idTexture, texCoord + vec2(-1, 1) / size * width).r;
            uint br = texture(idTexture, texCoord + vec2( 1, 1) / size * width).r;

            float sum = float(t != center) + float(b != center) + float(l != center) + float(r != center) +
                        float(tl != center) + float(tr != center) + float(bl != center) + float(br != center);

            return sum > 0.0;
        }
            
        void main(void) {
            uint id = texture(idTexture, texCoord).r;
            if(!edge(id, 1.0)){
                discard;
            }
            g_finalColor = readInfo(gameObjectTexture, id); //vec4(253.0 / 255.0, 218.0 / 255.0, 13.0 / 255.0, 0.95);//
        }

    `;
    
    return { vertex, fragment };
}

export default generate;