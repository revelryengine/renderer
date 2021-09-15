 const glsl = String.raw; // For syntax-highlighting
export const utils = glsl`
/********** process-utils.glsl.js **********/
struct Frustum {
    float near;
    float far;

    vec3 position;

    mat4 projectionMatrix;
    mat4 viewMatrix;
    mat4 viewProjectionMatrix;

    mat4 invProjectionMatrix;
    mat4 invViewProjectionMatrix;
};

uniform Frustum u_Frustum;

float getLinearDepth(float d, Frustum frustum) {
    return frustum.near * frustum.far / (frustum.far + d * (frustum.near - frustum.far));
}
/********** /process-utils.glsl.js **********/
`;

export default utils;