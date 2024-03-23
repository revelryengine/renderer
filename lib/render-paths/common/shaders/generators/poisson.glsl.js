import fullscreenVert from './fullscreen.vert.glsl.js';

/**
 * References:
 *
 * @see https://github.com/spite/Wagner/blob/87dde4895e38ab8c2ef432b1e623ece9484ea5cc/fragment-shaders/poisson-disc-blur-fs.glsl
 * @see http://developer.amd.com/wordpress/media/2012/10/GDC06-ATI_Session-Oat-ShaderTricks.pdf
 */

/**
 * @param {import('../shader.js').ShaderInitialized<import('../poisson-shader.js').PoissonShader>} shader
 */
export function generate({ uniforms }) {
    const vertex = fullscreenVert();

    const NUM_TAPS = 12;

    const fragment = /* glsl */`#version 300 es
        precision highp float;

        #pragma revTextureBinding(colorTexture, 2, 1, 0)
        uniform sampler2D colorTexture;

        ${uniforms.settings.generateUniformBlock(2, 2)}

        in vec2 texCoord;
        out vec4 g_finalColor;

        float nrand(vec2 n) {
            return fract(sin(dot(n.xy, vec2(12.9898, 78.233))) * 43758.5453);
        }

        vec2 rot2d( vec2 p, float a ) {
            vec2 sc = vec2(sin(a),cos(a));
            return vec2(dot( p, vec2(sc.y, -sc.x)), dot(p, sc.xy));
        }

        const vec2 taps[12] = vec2[](
            vec2(-0.326212,-0.40581 ),
            vec2(-0.840144,-0.07358 ),
            vec2(-0.695914, 0.457137),
            vec2(-0.203345, 0.620716),
            vec2( 0.96234 ,-0.194983),
            vec2( 0.473434,-0.480026),
            vec2( 0.519456, 0.767022),
            vec2( 0.185461,-0.893124),
            vec2( 0.507431, 0.064425),
            vec2( 0.89642 , 0.412458),
            vec2(-0.32194 ,-0.932615),
            vec2(-0.791559,-0.59771 )
        );


        void main(void) {
            vec2 texelSize = 1.0 / vec2(textureSize(colorTexture, 0));

            vec4 sum = texture(colorTexture, texCoord);

            float rnd  = 6.28 * nrand(texCoord);
            vec4 basis = vec4(rot2d(vec2(1.0, 0.0), rnd), rot2d(vec2(0.0, 1.0), rnd));

            for (int i = 0; i < ${NUM_TAPS}; i++) {
                vec2 offset = taps[i];
                // offset = vec2(dot(offset, basis.xz), dot(offset, basis.yw));
                vec2 coord = texCoord + poissonsettings.radius * offset * texelSize;
                sum = sum + texture(colorTexture, coord);
            }

            g_finalColor = sum / float(${NUM_TAPS + 1});
        }
    `;

    return { vertex, fragment };
}

export default generate;
