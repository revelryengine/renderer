export const skinning = /* glsl */`
/********** skinning.glsl.js **********/
#ifdef HAS_JOINTS_0
  in vec4 a_JOINTS_0;
#endif

#ifdef HAS_JOINTS_1
  in vec4 a_JOINTS_1;
#endif

#ifdef HAS_WEIGHTS_0
  in vec4 a_WEIGHTS_0;
#endif

#ifdef HAS_WEIGHTS_1
  in vec4 a_WEIGHTS_1;
#endif

#if defined(HAS_WEIGHTS_0) && defined(HAS_JOINTS_0)
  #define USE_SKINNING
#endif

#ifdef USE_SKINNING
  uniform mat4 u_jointMatrices[JOINT_COUNT];
  uniform mat4 u_jointNormalMatrices[JOINT_COUNT];

  mat4 getSkinningMatrix() {
    mat4 skin = mat4(0);

    #if defined(HAS_WEIGHTS_0) && defined(HAS_JOINTS_0)
      skin +=
        a_WEIGHTS_0.x * u_jointMatrices[int(a_JOINTS_0.x)] +
        a_WEIGHTS_0.y * u_jointMatrices[int(a_JOINTS_0.y)] +
        a_WEIGHTS_0.z * u_jointMatrices[int(a_JOINTS_0.z)] +
        a_WEIGHTS_0.w * u_jointMatrices[int(a_JOINTS_0.w)];
    #endif

    #if defined(HAS_WEIGHTS_1) && defined(HAS_JOINTS_1)
      skin +=
        a_WEIGHTS_1.x * u_jointMatrices[int(a_JOINTS_1.x)] +
        a_WEIGHTS_1.y * u_jointMatrices[int(a_JOINTS_1.y)] +
        a_WEIGHTS_1.z * u_jointMatrices[int(a_JOINTS_1.z)] +
        a_WEIGHTS_1.w * u_jointMatrices[int(a_JOINTS_1.w)];
    #endif

    return skin;
  }

  mat4 getSkinningNormalMatrix() {
    mat4 skin = mat4(0);

    #if defined(HAS_WEIGHTS_0) && defined(HAS_JOINTS_0)
      skin +=
        a_WEIGHTS_0.x * u_jointNormalMatrices[int(a_JOINTS_0.x)] +
        a_WEIGHTS_0.y * u_jointNormalMatrices[int(a_JOINTS_0.y)] +
        a_WEIGHTS_0.z * u_jointNormalMatrices[int(a_JOINTS_0.z)] +
        a_WEIGHTS_0.w * u_jointNormalMatrices[int(a_JOINTS_0.w)];
    #endif

    #if defined(HAS_WEIGHTS_1) && defined(HAS_JOINTS_1)
      skin +=
        a_WEIGHTS_1.x * u_jointNormalMatrices[int(a_JOINTS_1.x)] +
        a_WEIGHTS_1.y * u_jointNormalMatrices[int(a_JOINTS_1.y)] +
        a_WEIGHTS_1.z * u_jointNormalMatrices[int(a_JOINTS_1.z)] +
        a_WEIGHTS_1.w * u_jointNormalMatrices[int(a_JOINTS_1.w)];
    #endif

    return skin;
  }
#endif
/********** /skinning.glsl.js **********/
`;

export default skinning;
