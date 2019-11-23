export const morphing = /* glsl */`
/********** morphing.glsl.js **********/
#ifdef HAS_TARGET_0_POSITION
  in vec3 a_Target_0_POSITION;
#endif

#ifdef HAS_TARGET_1_POSITION
  in vec3 a_Target_1_POSITION;
#endif

#ifdef HAS_TARGET_2_POSITION
  in vec3 a_Target_2_POSITION;
#endif

#ifdef HAS_TARGET_3_POSITION
  in vec3 a_Target_3_POSITION;
#endif

#ifdef HAS_TARGET_4_POSITION
  in vec3 a_Target_4_POSITION;
#endif

#ifdef HAS_TARGET_5_POSITION
  in vec3 a_Target_5_POSITION;
#endif

#ifdef HAS_TARGET_6_POSITION
  in vec3 a_Target_6_POSITION;
#endif

#ifdef HAS_TARGET_7_POSITION
  in vec3 a_Target_7_POSITION;
#endif

#ifdef HAS_TARGET_0_NORMAL
  in vec3 a_Target_0_NORMAL;
#endif

#ifdef HAS_TARGET_1_NORMAL
  in vec3 a_Target_1_NORMAL;
#endif

#ifdef HAS_TARGET_2_NORMAL
  in vec3 a_Target_2_NORMAL;
#endif

#ifdef HAS_TARGET_3_NORMAL
  in vec3 a_Target_3_NORMAL;
#endif

#ifdef HAS_TARGET_0_TANGENT
  in vec3 a_Target_0_TANGENT;
#endif

#ifdef HAS_TARGET_1_TANGENT
  in vec3 a_Target_1_TANGENT;
#endif

#ifdef HAS_TARGET_2_TANGENT
  in vec3 a_Target_2_TANGENT;
#endif

#ifdef HAS_TARGET_3_TANGENT
  in vec3 a_Target_3_TANGENT;
#endif

#if defined(HAS_TARGET_0_POSITION) || defined(HAS_TARGET_0_NORMAL) || defined(HAS_TARGET_0_TANGENT)
  #define USE_MORPHING 1
#endif

#ifdef USE_MORPHING
  uniform float u_morphWeights[WEIGHT_COUNT];

  vec4 getTargetPosition() {
    vec4 pos = vec4(0);

    #ifdef HAS_TARGET_0_POSITION
      pos.xyz += u_morphWeights[0] * a_Target_0_POSITION;
    #endif

    #ifdef HAS_TARGET_1_POSITION
      pos.xyz += u_morphWeights[1] * a_Target_1_POSITION;
    #endif

    #ifdef HAS_TARGET_2_POSITION
      pos.xyz += u_morphWeights[2] * a_Target_2_POSITION;
    #endif

    #ifdef HAS_TARGET_3_POSITION
      pos.xyz += u_morphWeights[3] * a_Target_3_POSITION;
    #endif

    #ifdef HAS_TARGET_4_POSITION
      pos.xyz += u_morphWeights[4] * a_Target_4_POSITION;
    #endif

    #ifdef HAS_TARGET_5_POSITION
      pos.xyz += u_morphWeights[5] * a_Target_5_POSITION;
    #endif

    #ifdef HAS_TARGET_6_POSITION
      pos.xyz += u_morphWeights[6] * a_Target_6_POSITION;
    #endif

    #ifdef HAS_TARGET_7_POSITION
      pos.xyz += u_morphWeights[7] * a_Target_7_POSITION;
    #endif

    return pos;
  }

  vec4 getTargetNormal() {
    vec4 normal = vec4(0);

    #ifdef HAS_TARGET_0_NORMAL
      normal.xyz += u_morphWeights[0] * a_Target_0_NORMAL;
    #endif

    #ifdef HAS_TARGET_1_NORMAL
      normal.xyz += u_morphWeights[1] * a_Target_1_NORMAL;
    #endif

    #ifdef HAS_TARGET_2_NORMAL
      normal.xyz += u_morphWeights[2] * a_Target_2_NORMAL;
    #endif

    #ifdef HAS_TARGET_3_NORMAL
      normal.xyz += u_morphWeights[3] * a_Target_3_NORMAL;
    #endif

    return normal;
  }

  vec4 getTargetTangent() {
    vec4 tangent = vec4(0);

    #ifdef HAS_TARGET_0_TANGENT
      tangent.xyz += u_morphWeights[0] * a_Target_0_TANGENT;
    #endif

    #ifdef HAS_TARGET_1_TANGENT
      tangent.xyz += u_morphWeights[1] * a_Target_1_TANGENT;
    #endif

    #ifdef HAS_TARGET_2_TANGENT
      tangent.xyz += u_morphWeights[2] * a_Target_2_TANGENT;
    #endif

    #ifdef HAS_TARGET_3_TANGENT
      tangent.xyz += u_morphWeights[3] * a_Target_3_TANGENT;
    #endif

    return tangent;
  }

#endif
/********** /morphing.glsl.js **********/
`;

export default morphing;
