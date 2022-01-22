/**
 * This shader code comes from the glTF Sample Viewer code base.
 * @see https://github.com/KhronosGroup/glTF-Sample-Viewer/tree/f38421f/source/Renderer/shaders
 * 
 * Modifications:
 *  - @modification-transmission-texture-size Removed the need to pass in transimission size as a uniform
 *  - @modification-environment-ubo Added support for using a uniform buffer for the environment
 *  - @modification-material-ubo Added support for using uniform buffers for materials
 */

const glsl = String.raw; // For syntax-highlighting
export const textures = glsl`
/********** textures.glsl.js **********/
// IBL

uniform samplerCube u_LambertianEnvSampler;
uniform samplerCube u_GGXEnvSampler;
uniform sampler2D u_GGXLUT;
uniform samplerCube u_CharlieEnvSampler;
uniform sampler2D u_CharlieLUT;
uniform sampler2D u_SheenELUT;

/************  @modification-environment-ubo [1/1]****************/
// uniform int u_MipCount;
// uniform mat3 u_EnvRotation;
/************  /@modification-environment-ubo [1/1]****************/

// General Material


uniform sampler2D u_NormalSampler;
// @modification-material-ubo //uniform float u_NormalScale;
// @modification-material-ubo //uniform int u_NormalUVSet;
// @modification-material-ubo //uniform mat3 u_NormalUVTransform;

uniform sampler2D u_EmissiveSampler;
// @modification-material-ubo //uniform vec3 u_EmissiveFactor;
// @modification-material-ubo //uniform int u_EmissiveUVSet;
// @modification-material-ubo //uniform mat3 u_EmissiveUVTransform;

uniform sampler2D u_OcclusionSampler;
// @modification-material-ubo //uniform int u_OcclusionUVSet;
// @modification-material-ubo //uniform float u_OcclusionStrength;
// @modification-material-ubo //uniform mat3 u_OcclusionUVTransform;


in vec2 v_texcoord_0;
in vec2 v_texcoord_1;


vec2 getNormalUV()
{
    vec3 uv = vec3(u_NormalUVSet < 1 ? v_texcoord_0 : v_texcoord_1, 1.0);

#ifdef HAS_NORMAL_UV_TRANSFORM
    uv = u_NormalUVTransform * uv;
#endif

    return uv.xy;
}


vec2 getEmissiveUV()
{
    vec3 uv = vec3(u_EmissiveUVSet < 1 ? v_texcoord_0 : v_texcoord_1, 1.0);

#ifdef HAS_EMISSIVE_UV_TRANSFORM
    uv = u_EmissiveUVTransform * uv;
#endif

    return uv.xy;
}


vec2 getOcclusionUV()
{
    vec3 uv = vec3(u_OcclusionUVSet < 1 ? v_texcoord_0 : v_texcoord_1, 1.0);

#ifdef HAS_OCCLUSION_UV_TRANSFORM
    uv = u_OcclusionUVTransform * uv;
#endif

    return uv.xy;
}


// Metallic Roughness Material


#ifdef MATERIAL_METALLICROUGHNESS

uniform sampler2D u_BaseColorSampler;
// @modification-material-ubo //uniform int u_BaseColorUVSet;
// @modification-material-ubo //uniform mat3 u_BaseColorUVTransform;

uniform sampler2D u_MetallicRoughnessSampler;
// @modification-material-ubo //uniform int u_MetallicRoughnessUVSet;
// @modification-material-ubo //uniform mat3 u_MetallicRoughnessUVTransform;

vec2 getBaseColorUV()
{
    vec3 uv = vec3(u_BaseColorUVSet < 1 ? v_texcoord_0 : v_texcoord_1, 1.0);

#ifdef HAS_BASECOLOR_UV_TRANSFORM
    uv = u_BaseColorUVTransform * uv;
#endif

    return uv.xy;
}

vec2 getMetallicRoughnessUV()
{
    vec3 uv = vec3(u_MetallicRoughnessUVSet < 1 ? v_texcoord_0 : v_texcoord_1, 1.0);

#ifdef HAS_METALLICROUGHNESS_UV_TRANSFORM
    uv = u_MetallicRoughnessUVTransform * uv;
#endif

    return uv.xy;
}

#endif


// Specular Glossiness Material


#ifdef MATERIAL_SPECULARGLOSSINESS

uniform sampler2D u_DiffuseSampler;
// @modification-material-ubo //uniform int u_DiffuseUVSet;
// @modification-material-ubo //uniform mat3 u_DiffuseUVTransform;

uniform sampler2D u_SpecularGlossinessSampler;
// @modification-material-ubo //uniform int u_SpecularGlossinessUVSet;
// @modification-material-ubo //uniform mat3 u_SpecularGlossinessUVTransform;


vec2 getSpecularGlossinessUV()
{
    vec3 uv = vec3(u_SpecularGlossinessUVSet < 1 ? v_texcoord_0 : v_texcoord_1, 1.0);

#ifdef HAS_SPECULARGLOSSINESS_UV_TRANSFORM
    uv = u_SpecularGlossinessUVTransform * uv;
#endif

    return uv.xy;
}

vec2 getDiffuseUV()
{
    vec3 uv = vec3(u_DiffuseUVSet < 1 ? v_texcoord_0 : v_texcoord_1, 1.0);

#ifdef HAS_DIFFUSE_UV_TRANSFORM
    uv = u_DiffuseUVTransform * uv;
#endif

    return uv.xy;
}

#endif


// Clearcoat Material


#ifdef MATERIAL_CLEARCOAT

uniform sampler2D u_ClearcoatSampler;
// @modification-material-ubo //uniform int u_ClearcoatUVSet;
// @modification-material-ubo //uniform mat3 u_ClearcoatUVTransform;

uniform sampler2D u_ClearcoatRoughnessSampler;
// @modification-material-ubo //uniform int u_ClearcoatRoughnessUVSet;
// @modification-material-ubo //uniform mat3 u_ClearcoatRoughnessUVTransform;

uniform sampler2D u_ClearcoatNormalSampler;
// @modification-material-ubo //uniform int u_ClearcoatNormalUVSet;
// @modification-material-ubo //uniform mat3 u_ClearcoatNormalUVTransform;
// @modification-material-ubo //uniform float u_ClearcoatNormalScale;


vec2 getClearcoatUV()
{
    vec3 uv = vec3(u_ClearcoatUVSet < 1 ? v_texcoord_0 : v_texcoord_1, 1.0);
#ifdef HAS_CLEARCOAT_UV_TRANSFORM
    uv = u_ClearcoatUVTransform * uv;
#endif
    return uv.xy;
}

vec2 getClearcoatRoughnessUV()
{
    vec3 uv = vec3(u_ClearcoatRoughnessUVSet < 1 ? v_texcoord_0 : v_texcoord_1, 1.0);
#ifdef HAS_CLEARCOATROUGHNESS_UV_TRANSFORM
    uv = u_ClearcoatRoughnessUVTransform * uv;
#endif
    return uv.xy;
}

vec2 getClearcoatNormalUV()
{
    vec3 uv = vec3(u_ClearcoatNormalUVSet < 1 ? v_texcoord_0 : v_texcoord_1, 1.0);
#ifdef HAS_CLEARCOATNORMAL_UV_TRANSFORM
    uv = u_ClearcoatNormalUVTransform * uv;
#endif
    return uv.xy;
}

#endif


// Sheen Material


#ifdef MATERIAL_SHEEN

uniform sampler2D u_SheenColorSampler;
// @modification-material-ubo //uniform int u_SheenColorUVSet;
// @modification-material-ubo //uniform mat3 u_SheenColorUVTransform;

uniform sampler2D u_SheenRoughnessSampler;
// @modification-material-ubo //uniform int u_SheenRoughnessUVSet;
// @modification-material-ubo //uniform mat3 u_SheenRoughnessUVTransform;


vec2 getSheenColorUV()
{
    vec3 uv = vec3(u_SheenColorUVSet < 1 ? v_texcoord_0 : v_texcoord_1, 1.0);
#ifdef HAS_SHEENCOLOR_UV_TRANSFORM
    uv = u_SheenColorUVTransform * uv;
#endif
    return uv.xy;
}

vec2 getSheenRoughnessUV()
{
    vec3 uv = vec3(u_SheenRoughnessUVSet < 1 ? v_texcoord_0 : v_texcoord_1, 1.0);
#ifdef HAS_SHEENROUGHNESS_UV_TRANSFORM
    uv = u_SheenRoughnessUVTransform * uv;
#endif
    return uv.xy;
}

#endif


// Specular Material


#ifdef MATERIAL_SPECULAR

uniform sampler2D u_SpecularSampler;
// @modification-material-ubo //uniform int u_SpecularUVSet;
// @modification-material-ubo //uniform mat3 u_SpecularUVTransform;

uniform sampler2D u_SpecularColorSampler;
// @modification-material-ubo //uniform int u_SpecularColorUVSet;
// @modification-material-ubo //uniform mat3 u_SpecularColorUVTransform;


vec2 getSpecularUV()
{
    vec3 uv = vec3(u_SpecularUVSet < 1 ? v_texcoord_0 : v_texcoord_1, 1.0);
#ifdef HAS_SPECULAR_UV_TRANSFORM
    uv = u_SpecularUVTransform * uv;
#endif
    return uv.xy;
}

vec2 getSpecularColorUV()
{
    vec3 uv = vec3(u_SpecularColorUVSet < 1 ? v_texcoord_0 : v_texcoord_1, 1.0);
#ifdef HAS_SPECULARCOLOR_UV_TRANSFORM
    uv = u_SpecularColorUVTransform * uv;
#endif
    return uv.xy;
}

#endif


// Transmission Material


#ifdef MATERIAL_TRANSMISSION

uniform sampler2D u_TransmissionSampler;
// @modification-material-ubo //uniform int u_TransmissionUVSet;
// @modification-material-ubo //uniform mat3 u_TransmissionUVTransform;

uniform sampler2D u_TransmissionFramebufferSampler;

/************ @modification-transmission-texture-size ****************/
//uniform ivec2 u_TransmissionFramebufferSize;
/************ /@modification-transmission-texture-size ****************/


vec2 getTransmissionUV()
{
    vec3 uv = vec3(u_TransmissionUVSet < 1 ? v_texcoord_0 : v_texcoord_1, 1.0);
#ifdef HAS_TRANSMISSION_UV_TRANSFORM
    uv = u_TransmissionUVTransform * uv;
#endif
    return uv.xy;
}

#endif


// Volume Material


#ifdef MATERIAL_VOLUME

uniform sampler2D u_ThicknessSampler;
// @modification-material-ubo //uniform int u_ThicknessUVSet;
// @modification-material-ubo //uniform mat3 u_ThicknessUVTransform;


vec2 getThicknessUV()
{
    vec3 uv = vec3(u_ThicknessUVSet < 1 ? v_texcoord_0 : v_texcoord_1, 1.0);
#ifdef HAS_THICKNESS_UV_TRANSFORM
    uv = u_ThicknessUVTransform * uv;
#endif
    return uv.xy;
}

#endif
/********** /textures.glsl.js **********/
`;

export default textures;
