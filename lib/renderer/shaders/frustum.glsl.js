import { Frustum } from '../../utils/frustum.js';

const glsl = String.raw; // For syntax-highlighting
export const frustum = glsl`
/********** frustum.glsl.js **********/
${Frustum.getShaderSource()}

float getLinearDepth(float d) {
    return u_FrustumNear * u_FrustumFar / (u_FrustumFar + d * (u_FrustumNear - u_FrustumFar));
}

mat4 readMatrix(sampler2DArray tex, int i) {
    vec2 size = vec2(textureSize(tex, 0));

    float index  = float(i) * 4.0;

    int tx = int(mod(index, size.x));
    int ty = int(floor(index / size.x));
    int tz = int(floor(index / (size.x * size.y * 4.0)));

    return mat4(
        texelFetch(tex, ivec3(tx + 0, ty, tz), 0),
        texelFetch(tex, ivec3(tx + 1, ty, tz), 0),
        texelFetch(tex, ivec3(tx + 2, ty, tz), 0),
        texelFetch(tex, ivec3(tx + 3, ty, tz), 0)
    );
}
/********** /frustum.frag.js **********/
`;

export default frustum;