import { Frustum } from '../../utils/frustum.js';

const glsl = String.raw; // For syntax-highlighting
export const frustum = glsl`
/** */
${Frustum.getShaderSource()}

float getLinearDepth(float d) {
    return u_FrustumNear * u_FrustumFar / (u_FrustumFar + d * (u_FrustumNear - u_FrustumFar));
}
`;

export default frustum;