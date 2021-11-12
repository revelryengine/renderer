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
    float offset = 0.5; 

    float tx = mod(index, size.x) + offset;
    float ty = floor(index / size.x) + offset;
    float tz = floor(index / (size.x * size.y * 4.0));
    return mat4(
        texture(tex, vec3((tx + 0.0) / size.x, ty / size.y, tz)),
        texture(tex, vec3((tx + 1.0) / size.x, ty / size.y, tz)),
        texture(tex, vec3((tx + 2.0) / size.x, ty / size.y, tz)),
        texture(tex, vec3((tx + 3.0) / size.x, ty / size.y, tz))
    );
}
/********** /frustum.frag.js **********/
`;

export default frustum;