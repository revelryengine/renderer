/**
 * This shader comes from the glTF Sample Viewer code base.
 * @see https://github.com/KhronosGroup/glTF-Sample-Viewer/tree/f38421f/source/Renderer/shaders
 * 
 * Modifications:
 * 
 * - @modification-skinning-texture Added support for using textures for skinning
 */

const glsl = String.raw; // For syntax-highlighting
export const animation = glsl`
/********** animation.glsl.js **********/
#ifdef HAS_TARGET_POSITION0_VEC3
in vec3 a_target_position0;
#endif

#ifdef HAS_TARGET_POSITION1_VEC3
in vec3 a_target_position1;
#endif

#ifdef HAS_TARGET_POSITION2_VEC3
in vec3 a_target_position2;
#endif

#ifdef HAS_TARGET_POSITION3_VEC3
in vec3 a_target_position3;
#endif

#ifdef HAS_TARGET_POSITION4_VEC3
in vec3 a_target_position4;
#endif

#ifdef HAS_TARGET_POSITION5_VEC3
in vec3 a_target_position5;
#endif

#ifdef HAS_TARGET_POSITION6_VEC3
in vec3 a_target_position6;
#endif

#ifdef HAS_TARGET_POSITION7_VEC3
in vec3 a_target_position7;
#endif

#ifdef HAS_TARGET_NORMAL0_VEC3
in vec3 a_target_normal0;
#endif

#ifdef HAS_TARGET_NORMAL1_VEC3
in vec3 a_target_normal1;
#endif

#ifdef HAS_TARGET_NORMAL2_VEC3
in vec3 a_target_normal2;
#endif

#ifdef HAS_TARGET_NORMAL3_VEC3
in vec3 a_target_normal3;
#endif

#ifdef HAS_TARGET_NORMAL4_VEC3
in vec3 a_target_normal4;
#endif

#ifdef HAS_TARGET_NORMAL5_VEC3
in vec3 a_target_normal5;
#endif

#ifdef HAS_TARGET_NORMAL6_VEC3
in vec3 a_target_normal6;
#endif

#ifdef HAS_TARGET_NORMAL7_VEC3
in vec3 a_target_normal7;
#endif

#ifdef HAS_TARGET_TANGENT0_VEC3
in vec3 a_target_tangent0;
#endif

#ifdef HAS_TARGET_TANGENT1_VEC3
in vec3 a_target_tangent1;
#endif

#ifdef HAS_TARGET_TANGENT2_VEC3
in vec3 a_target_tangent2;
#endif

#ifdef HAS_TARGET_TANGENT3_VEC3
in vec3 a_target_tangent3;
#endif

#ifdef HAS_TARGET_TANGENT4_VEC3
in vec3 a_target_tangent4;
#endif

#ifdef HAS_TARGET_TANGENT5_VEC3
in vec3 a_target_tangent5;
#endif

#ifdef HAS_TARGET_TANGENT6_VEC3
in vec3 a_target_tangent6;
#endif

#ifdef HAS_TARGET_TANGENT7_VEC3
in vec3 a_target_tangent7;
#endif

#ifdef USE_MORPHING
//@modification-skinning-texture //uniform float u_MorphWeights[WEIGHT_COUNT];
#endif

#ifdef HAS_JOINTS_0_VEC4
in vec4 a_joints_0;
#endif

#ifdef HAS_JOINTS_1_VEC4
in vec4 a_joints_1;
#endif

#ifdef HAS_WEIGHTS_0_VEC4
in vec4 a_weights_0;
#endif

#ifdef HAS_WEIGHTS_1_VEC4
in vec4 a_weights_1;
#endif

/************  @modification-skinning-texture [1/1]****************/
// #ifdef USE_SKINNING
// 
// uniform mat4 u_jointMatrix[JOINT_COUNT];
// uniform mat4 u_jointNormalMatrix[JOINT_COUNT];
// 
// #endif

// #ifdef USE_SKINNING

// mat4 getSkinningMatrix()
// {
//     mat4 skin = mat4(0);

// #if defined(HAS_WEIGHTS_0_VEC4) && defined(HAS_JOINTS_0_VEC4)
//     skin +=
//         a_weights_0.x * u_jointMatrix[int(a_joints_0.x)] +
//         a_weights_0.y * u_jointMatrix[int(a_joints_0.y)] +
//         a_weights_0.z * u_jointMatrix[int(a_joints_0.z)] +
//         a_weights_0.w * u_jointMatrix[int(a_joints_0.w)];
// #endif

// #if defined(HAS_WEIGHTS_1_VEC4) && defined(HAS_JOINTS_1_VEC4)
//     skin +=
//         a_weights_1.x * u_jointMatrix[int(a_joints_1.x)] +
//         a_weights_1.y * u_jointMatrix[int(a_joints_1.y)] +
//         a_weights_1.z * u_jointMatrix[int(a_joints_1.z)] +
//         a_weights_1.w * u_jointMatrix[int(a_joints_1.w)];
// #endif

//     return skin;
// }


// mat4 getSkinningNormalMatrix()
// {
//     mat4 skin = mat4(0);

// #if defined(HAS_WEIGHTS_0_VEC4) && defined(HAS_JOINTS_0_VEC4)
//     skin +=
//         a_weights_0.x * u_jointNormalMatrix[int(a_joints_0.x)] +
//         a_weights_0.y * u_jointNormalMatrix[int(a_joints_0.y)] +
//         a_weights_0.z * u_jointNormalMatrix[int(a_joints_0.z)] +
//         a_weights_0.w * u_jointNormalMatrix[int(a_joints_0.w)];
// #endif

// #if defined(HAS_WEIGHTS_1_VEC4) && defined(HAS_JOINTS_1_VEC4)
//     skin +=
//         a_weights_1.x * u_jointNormalMatrix[int(a_joints_1.x)] +
//         a_weights_1.y * u_jointNormalMatrix[int(a_joints_1.y)] +
//         a_weights_1.z * u_jointNormalMatrix[int(a_joints_1.z)] +
//         a_weights_1.w * u_jointNormalMatrix[int(a_joints_1.w)];
// #endif

//     return skin;
// }

// #endif // !USE_SKINNING

mat4 getSkinningMatrix(int jointIndex)
{
    mat4 skin = mat4(0);

#if defined(HAS_WEIGHTS_0_VEC4) && defined(HAS_JOINTS_0_VEC4)
    skin +=
        a_weights_0.x * readMatrix(u_InstanceSampler, jointIndex + int(a_joints_0.x)) +
        a_weights_0.y * readMatrix(u_InstanceSampler, jointIndex + int(a_joints_0.y)) +
        a_weights_0.z * readMatrix(u_InstanceSampler, jointIndex + int(a_joints_0.z)) +
        a_weights_0.w * readMatrix(u_InstanceSampler, jointIndex + int(a_joints_0.w));
#endif

#if defined(HAS_WEIGHTS_1_VEC4) && defined(HAS_JOINTS_1_VEC4)
    skin +=
        a_weights_1.x * readMatrix(u_InstanceSampler, jointIndex + int(a_joints_1.x)) +
        a_weights_1.y * readMatrix(u_InstanceSampler, jointIndex + int(a_joints_1.y)) +
        a_weights_1.z * readMatrix(u_InstanceSampler, jointIndex + int(a_joints_1.z)) +
        a_weights_1.w * readMatrix(u_InstanceSampler, jointIndex + int(a_joints_1.w));
#endif

    return skin;
}


mat4 getSkinningNormalMatrix(int jointIndex, int jointCount)
{
    return getSkinningMatrix(jointIndex + jointCount);
}
/************  /@modification-skinning-texture [1/1]****************/


/************  @modification-skinning-texture [2/2]****************/
// added mat4 morphWeights input and replaced u_MorphWeights with morphWeights below
//float morphWeights[WEIGHT_COUNT]
/************  /@modification-skinning-texture [2/2]****************/
#ifdef USE_MORPHING

vec4 getTargetPosition(mat4 morphWeights)
{
    vec4 pos = vec4(0);

#ifdef HAS_TARGET_POSITION0_VEC3
    pos.xyz += morphWeights[0][0] * a_target_position0;
#endif

#ifdef HAS_TARGET_POSITION1_VEC3
    pos.xyz += morphWeights[0][1] * a_target_position1;
#endif

#ifdef HAS_TARGET_POSITION2_VEC3
    pos.xyz += morphWeights[0][2] * a_target_position2;
#endif

#ifdef HAS_TARGET_POSITION3_VEC3
    pos.xyz += morphWeights[0][3] * a_target_position3;
#endif

#ifdef HAS_TARGET_POSITION4_VEC3
    pos.xyz += morphWeights[1][0] * a_target_position4;
#endif

#ifdef HAS_TARGET_POSITION5_VEC3
    pos.xyz += morphWeights[1][1] * a_target_position5;
#endif

#ifdef HAS_TARGET_POSITION6_VEC3
    pos.xyz += morphWeights[1][2] * a_target_position6;
#endif

#ifdef HAS_TARGET_POSITION7_VEC3
    pos.xyz += morphWeights[1][3] * a_target_position7;
#endif

    return pos;
}

vec3 getTargetNormal(mat4 morphWeights)
{
    vec3 normal = vec3(0);

#ifdef HAS_TARGET_NORMAL0_VEC3
    normal += morphWeights[0][0] * a_target_normal0;
#endif

#ifdef HAS_TARGET_NORMAL1_VEC3
    normal += morphWeights[0][1] * a_target_normal1;
#endif

#ifdef HAS_TARGET_NORMAL2_VEC3
    normal += morphWeights[0][2] * a_target_normal2;
#endif

#ifdef HAS_TARGET_NORMAL3_VEC3
    normal += morphWeights[0][3] * a_target_normal3;
#endif

#ifdef HAS_TARGET_NORMAL4_VEC3
    normal += morphWeights[1][0] * a_target_normal4;
#endif

#ifdef HAS_TARGET_NORMAL5_VEC3
    normal += morphWeights[1][1] * a_target_normal5;
#endif

#ifdef HAS_TARGET_NORMAL6_VEC3
    normal += morphWeights[1][2] * a_target_normal6;
#endif

#ifdef HAS_TARGET_NORMAL7_VEC3
    normal += morphWeights[1][3] * a_target_normal7;
#endif

    return normal;
}


vec3 getTargetTangent(mat4 morphWeights)
{
    vec3 tangent = vec3(0);

#ifdef HAS_TARGET_TANGENT0_VEC3
    tangent += morphWeights[0][0] * a_target_tangent0;
#endif

#ifdef HAS_TARGET_TANGENT1_VEC3
    tangent += morphWeights[0][1] * a_target_tangent1;
#endif

#ifdef HAS_TARGET_TANGENT2_VEC3
    tangent += morphWeights[0][2] * a_target_tangent2;
#endif

#ifdef HAS_TARGET_TANGENT3_VEC3
    tangent += morphWeights[0][3] * a_target_tangent3;
#endif

#ifdef HAS_TARGET_TANGENT4_VEC3
    tangent += morphWeights[1][0] * a_target_tangent4;
#endif

#ifdef HAS_TARGET_TANGENT5_VEC3
    tangent += morphWeights[1][1] * a_target_tangent5;
#endif

#ifdef HAS_TARGET_TANGENT6_VEC3
    tangent += morphWeights[1][2] * a_target_tangent6;
#endif

#ifdef HAS_TARGET_TANGENT7_VEC3
    tangent += morphWeights[1][3] * a_target_tangent7;
#endif

    return tangent;
}

#endif // !USE_MORPHING

/********** /animation.glsl.js **********/
`;

export default animation;