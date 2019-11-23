export const textures = /* glsl */`
/********** textures.glsl.js **********/
varying vec2 v_uvCoord0;
varying vec2 v_uvCoord1;

// General Material
#ifdef HAS_NORMALTEXTURE
  uniform sampler2D u_normalTexture;
  uniform int u_normalTexture_texCoord;
  uniform float u_normalTexture_scale;
  uniform mat3 u_normalTexture_transform;
#endif

#ifdef HAS_EMISSIVETEXTURE
  uniform sampler2D u_emissiveTexture;
  uniform int u_emissiveTexture_texCoord;
  uniform vec3 u_emissiveTexture_emissiveFactor;
  uniform mat3 u_emissiveTexture_transform;
#endif

#ifdef HAS_OCCLUSIONTEXTURE
  uniform sampler2D u_occlusionTexture;
  uniform int u_occlusionTexture_texCoord;
  uniform float u_occlusionTexture_strength;
  uniform mat3 u_occlusionTexture_transform;
#endif

// Metallic Roughness Material
#ifdef HAS_BASECOLORTEXTURE
  uniform sampler2D u_baseColorTexture;
  uniform int u_baseColorTexture_texCoord;
  uniform mat3 u_baseColorTexture_transform;
#endif

#ifdef HAS_METALLICROUGHNESSTEXTURE
  uniform sampler2D u_metallicRoughnessTexture;
  uniform int u_metallicRoughnessTexture_texCoord;
  uniform mat3 u_metallicRoughnessTexture_transform;
#endif

uniform float u_metallicFactor;
uniform float u_roughnessFactor;
uniform vec4 u_baseColorFactor;

#ifdef ALPHAMODE_MASK
  uniform float u_alphaCutoff;
#endif

// IBL
#ifdef USE_IBL
  uniform samplerCube u_diffuseEnvTexture;
  uniform samplerCube u_specularEnvTexture;
  uniform sampler2D u_brdfLUT;
#endif

vec2 getNormalUV() {
  vec3 uv = vec3(v_uvCoord0, 1.0);
  #ifdef HAS_NORMALTEXTURE
    uv.xy = u_normalTexture_texCoord < 1 ? v_uvCoord0 : v_uvCoord1;
    #ifdef HAS_NORMALTEXTURE_TRANSFORM
      uv *= u_normalTexture_transform;
    #endif
  #endif
  return uv.xy;
}

vec2 getEmissiveUV() {
  vec3 uv = vec3(v_uvCoord0, 1.0);
  #ifdef HAS_EMISSIVETEXTURE
    uv.xy = u_emissiveTexture_texCoord < 1 ? v_uvCoord0 : v_uvCoord1;
    #ifdef HAS_EMISSIVETEXTURE_TRANSFORM
      uv *= u_emissiveTexture_transform;
    #endif
  #endif
  return uv.xy;
}

vec2 getOcclusionUV() {
  vec3 uv = vec3(v_uvCoord0, 1.0);
  #ifdef HAS_OCCLUSIONTEXTURE
    uv.xy = u_occlusionTexture_texCoord < 1 ? v_uvCoord0 : v_uvCoord1;
    #ifdef HAS_OCCLSIONTEXTURE_TRANSFORM
      uv *= u_occlusionTexture_transform;
    #endif
  #endif
  return uv.xy;
}

vec2 getBaseColorUV() {
  vec3 uv = vec3(v_uvCoord0, 1.0);
  #ifdef HAS_BASECOLORTEXTURE
    uv.xy = u_baseColorTexture_texCoord < 1 ? v_uvCoord0 : v_uvCoord1;
    #ifdef HAS_BASECOLORTEXTURE_TRANSFORM
      uv *= u_baseColorTexture_transform;
    #endif
  #endif
  return uv.xy;
}

vec2 getMetallicRoughnessUV() {
  vec3 uv = vec3(v_uvCoord0, 1.0);
  #ifdef HAS_METALLICROUGHNESSTEXTURE
    uv.xy = u_metallicRoughnessTexture_texCoord < 1 ? v_uvCoord0 : v_uvCoord1;
    #ifdef HAS_METALLICROUGHNESSTEXTURE_TRANSFORM
      uv *= u_metallicRoughnessTexture_transform;
    #endif
  #endif
  return uv.xy;
}

#ifdef HAS_KHR_MATERIALS_PBRSPECULARGLOSSINESS
  uniform vec3 u_KHR_materials_pbrSpecularGlossiness_specularFactor;
  uniform vec4 u_KHR_materials_pbrSpecularGlossiness_diffuseFactor;
  uniform float u_KHR_materials_pbrSpecularGlossiness_glossinessFactor;

  #ifdef HAS_KHR_MATERIALS_PBRSPECULARGLOSSINESS_DIFFUSETEXTURE
    uniform sampler2D u_KHR_materials_pbrSpecularGlossiness_diffuseTexture;
    uniform int u_KHR_materials_pbrSpecularGlossiness_diffuseTexture_texCoord;
    uniform mat3 u_KHR_materials_pbrSpecularGlossiness_diffuseTexture_transform;

    vec2 getKHRMaterialsPBRSpecularGlossinessDiffuseUV() {
      vec3 uv = vec3(v_uvCoord0, 1.0);
      uv.xy = u_KHR_materials_pbrSpecularGlossiness_diffuseTexture_texCoord < 1 ? v_uvCoord0 : v_uvCoord1;
      #ifdef HAS_KHR_MATERIALS_PBRSPECULARGLOSSINESS_DIFFUSETEXTURE_TRANSFORM
        uv *= u_KHR_materials_pbrSpecularGlossiness_diffuseTexture_transform;
      #endif
      return uv.xy;
    }
  #endif

  #ifdef HAS_KHR_MATERIALS_PBRSPECULARGLOSSINESS_SPECULARGLOSSINESSTEXTURE
    uniform sampler2D u_KHR_materials_pbrSpecularGlossiness_specularGlossinessTexture;
    uniform int u_KHR_materials_pbrSpecularGlossiness_specularGlossinessTexture_texCoord;
    uniform mat3 u_KHR_materials_pbrSpecularGlossiness_specularGlossinessTexture_transform;

    vec2 getKHRMaterialsPBRSpecularGlossinessSpecularGlossinessUV() {
      vec3 uv = vec3(v_uvCoord0, 1.0);
      uv.xy = u_KHR_materials_pbrSpecularGlossiness_specularGlossinessTexture_texCoord < 1 ? v_uvCoord0 : v_uvCoord1;
      #ifdef HAS_KHR_MATERIALS_PBRSPECULARGLOSSINESS_SPECULARGLOSSINESSTEXTURE_TRANSFORM
        uv *= u_KHR_materials_pbrSpecularGlossiness_specularGlossinessTexture_transform;
      #endif
      return uv.xy;
    }
  #endif
#endif

#ifdef HAS_KHR_MATERIALS_SPECULAR
  uniform float u_KHR_materials_specular_specularFactor;

  #ifdef HAS_KHR_MATERIALS_SPECULAR_SPECULARTEXTURE
    uniform sampler2D u_KHR_materials_specular_specularTexture;
    uniform int u_KHR_materials_specular_specularTexture_texCoord;
    uniform mat3 u_KHR_materials_specular_specularTexture_transform;

    vec2 getKHRMaterialsSpecularUV() {
      vec3 uv = vec3(v_uvCoord0, 1.0);

      uv.xy = u_KHR_materials_specular_specularTexture_texCoord < 1 ? v_uvCoord0 : v_uvCoord1;
      #ifdef HAS_KHR_MATERIALS_SPECULAR_SPECULARTEXTURE_TRANSFORM
        uv *= u_KHR_materials_specular_specularTexture_transform;
      #endif

      return uv.xy;
    }
  #endif
#endif

#ifdef HAS_KHR_MATERIALS_CLEARCOAT
  uniform float u_KHR_materials_clearcoat_clearcoatFactor;
  uniform float u_KHR_materials_clearcoat_clearcoatRoughnessFactor;

  // vec3 applyClearCoat(vec3 color, AngularInfo angularInfo) {
  //   factor0 = (1.0 - clearcoatFactor * fresnel(0.04, NdotV)) * (1.0 - clearcoatFactor * fresnel(0.04, NdotL));
  //   factor1 = clearcoatFactor * fresnel(0.04, HdotV);
  //   return color * factor0 + f_clearcoat * factor1;
  // }

#endif
/********** /textures.glsl.js **********/
`;

export default textures;
