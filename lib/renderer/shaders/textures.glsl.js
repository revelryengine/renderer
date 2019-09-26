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

// Specular Glossiness Material
#ifdef HAS_DIFFUSETEXTURE
  uniform sampler2D u_diffuseTexture;
  uniform int u_diffuseTexture_texCoord;
  uniform mat3 u_diffuseTexture_transform;
#endif

#ifdef HAS_SPECULARGLOSSINESSTEXTURE
  uniform sampler2D u_specularGlossinessTexture;
  uniform int u_specularGlossinessTexture_texCoord;
  uniform mat3 u_specularGlossinessTexture_transform;
#endif

#ifdef MATERIAL_SPECULARGLOSSINESS
  uniform vec3 u_specularFactor;
  uniform vec4 u_diffuseFactor;
  uniform float u_glossinessFactor;
#endif

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

vec2 getSpecularGlossinessUV() {
  vec3 uv = vec3(v_uvCoord0, 1.0);
  #ifdef HAS_SPECULARGLOSSINESSTEXTURE
    uv.xy = u_specularGlossinessTexture_texCoord < 1 ? v_uvCoord0 : v_uvCoord1;
    #ifdef HAS_SPECULARGLOSSINESSTEXTURE_TRANSFORM
      uv *= u_specularGlossinessTexture_transform;
    #endif
  #endif
  return uv.xy;
}

vec2 getDiffuseUV() {
  vec3 uv = vec3(v_uvCoord0, 1.0);
  #ifdef HAS_DIFFUSETEXTURE
    uv.xy = u_diffuseTexture_texCoord < 1 ? v_uvCoord0 : v_uvCoord1;
    #ifdef HAS_DIFFUSETEXTURE_TRANSFORM
      uv *= u_diffuseTexture_transform;
    #endif
  #endif
  return uv.xy;
}
/********** /textures.glsl.js **********/
`;

export default textures;
