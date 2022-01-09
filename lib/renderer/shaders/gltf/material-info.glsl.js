/**
 * This shader code comes from the glTF Sample Viewer code base.
 * @see https://github.com/KhronosGroup/glTF-Sample-Viewer/tree/f38421f/source/Renderer/shaders
 * 
 * Modifications:
 * - @modification-instance Added support for instanced rendering
 * - @modification-frustum-ubo Added support for using uniform buffers for frustum
 * - @modification-material-ubo Added for using uniform buffers for materials
 */

const glsl = String.raw; // For syntax-highlighting
export const materialInfo = glsl`
/********** material-info.glsl.js **********/
// Metallic Roughness
// @modification-material-ubo //uniform float u_MetallicFactor;
// @modification-material-ubo //uniform float u_RoughnessFactor;
// @modification-material-ubo //uniform vec4 u_BaseColorFactor;

// Specular Glossiness
// @modification-material-ubo //uniform vec3 u_SpecularFactor;
// @modification-material-ubo //uniform vec4 u_DiffuseFactor;
// @modification-material-ubo //uniform float u_GlossinessFactor;

// Sheen
// @modification-material-ubo //uniform float u_SheenRoughnessFactor;
// @modification-material-ubo //uniform vec3 u_SheenColorFactor;

// Clearcoat
// @modification-material-ubo //uniform float u_ClearcoatFactor;
// @modification-material-ubo //uniform float u_ClearcoatRoughnessFactor;

// Specular
// @modification-material-ubo //uniform vec3 u_KHR_materials_specular_specularColorFactor;
// @modification-material-ubo //uniform float u_KHR_materials_specular_specularFactor;

// Transmission
// @modification-material-ubo //uniform float u_TransmissionFactor;

// Volume
// @modification-material-ubo //uniform float u_ThicknessFactor;
// @modification-material-ubo //uniform vec3 u_AttenuationColor;
// @modification-material-ubo //uniform float u_AttenuationDistance;

//PBR Next IOR
// @modification-material-ubo //uniform float u_Ior;

// Alpha mode
// @modification-material-ubo //uniform float u_AlphaCutoff;

// @modification-material-ubo //#ifdef MATERIAL_TRANSMISSION
// @modification-material-ubo //uniform ivec2 u_ScreenSize;
// @modification-material-ubo //#endif
/************  @modification-instance [1/1]****************/
in mat4 v_ModelMatrix;
/************  /@modification-instance [1/1]****************/

/************  @modification-frustum-ubo [1/1]****************/
// uniform vec3 u_Camera;
// uniform mat4 u_ViewMatrix;
// uniform mat4 u_ProjectionMatrix;
/************  /@modification-frustum-ubo [1/1]****************/

struct MaterialInfo
{
    float ior;
    float perceptualRoughness;      // roughness value, as authored by the model creator (input to shader)
    vec3 f0;                        // full reflectance color (n incidence angle)

    float alphaRoughness;           // roughness mapped to a more linear change in the roughness (proposed by [2])
    vec3 c_diff;

    vec3 f90;                       // reflectance color at grazing angle
    float metallic;

    vec3 baseColor;

    float sheenRoughnessFactor;
    vec3 sheenColorFactor;

    vec3 clearcoatF0;
    vec3 clearcoatF90;
    float clearcoatFactor;
    vec3 clearcoatNormal;
    float clearcoatRoughness;

    // KHR_materials_specular 
    float specularWeight; // product of specularFactor and specularTexture.a

    float transmissionFactor;

    float thickness;
    vec3 attenuationColor;
    float attenuationDistance;
};


// Get normal, tangent and bitangent vectors.
NormalInfo getNormalInfo(vec3 v)
{
    vec2 UV = getNormalUV();
    vec3 uv_dx = dFdx(vec3(UV, 0.0));
    vec3 uv_dy = dFdy(vec3(UV, 0.0));

    vec3 t_ = (uv_dy.t * dFdx(v_Position) - uv_dx.t * dFdy(v_Position)) /
        (uv_dx.s * uv_dy.t - uv_dy.s * uv_dx.t);

    vec3 n, t, b, ng;

    // Compute geometrical TBN:
#ifdef HAS_TANGENT_VEC4
    // Trivial TBN computation, present as vertex attribute.
    // Normalize eigenvectors as matrix is linearly interpolated.
    t = normalize(v_Tangent);
    b = normalize(v_Bitangent);
    ng = normalize(v_Normal);
#else
    // Normals are either present as vertex attributes or approximated.
#ifdef HAS_NORMAL_VEC3
    ng = normalize(v_Normal);
#else
    ng = normalize(cross(dFdx(v_Position), dFdy(v_Position)));
#endif
    t = normalize(t_ - ng * dot(ng, t_));
    b = cross(ng, t);
#endif

    // For a back-facing surface, the tangential basis vectors are negated.
    if (gl_FrontFacing == false)
    {
        t *= -1.0;
        b *= -1.0;
        ng *= -1.0;
    }

    // Compute pertubed normals:
#ifdef HAS_NORMAL_MAP
    n = texture(u_NormalSampler, UV).rgb * 2.0 - vec3(1.0);
    n *= vec3(u_NormalScale, u_NormalScale, 1.0);
    n = mat3(t, b, ng) * normalize(n);
#else
    n = ng;
#endif

    NormalInfo info;
    info.ng = ng;
    info.t = t;
    info.b = b;
    info.n = n;
    return info;
}


vec3 getClearcoatNormal(NormalInfo normalInfo)
{
#ifdef HAS_CLEARCOAT_NORMAL_MAP
    vec3 n = texture(u_ClearcoatNormalSampler, getClearcoatNormalUV()).rgb * 2.0 - vec3(1.0);
    n *= vec3(u_ClearcoatNormalScale, u_ClearcoatNormalScale, 1.0);
    n = mat3(normalInfo.t, normalInfo.b, normalInfo.ng) * normalize(n);
    return n;
#else
    return normalInfo.ng;
#endif
}


vec4 getBaseColor()
{
    vec4 baseColor = vec4(1);

#if defined(MATERIAL_SPECULARGLOSSINESS)
    baseColor = u_DiffuseFactor;
#elif defined(MATERIAL_METALLICROUGHNESS)
    baseColor = u_BaseColorFactor;
#endif

#if defined(MATERIAL_SPECULARGLOSSINESS) && defined(HAS_DIFFUSE_MAP)
    baseColor *= texture(u_DiffuseSampler, getDiffuseUV());
#elif defined(MATERIAL_METALLICROUGHNESS) && defined(HAS_BASE_COLOR_MAP)
    baseColor *= texture(u_BaseColorSampler, getBaseColorUV());
#endif

    return baseColor * getVertexColor();
}


#ifdef MATERIAL_SPECULARGLOSSINESS
MaterialInfo getSpecularGlossinessInfo(MaterialInfo info)
{
    info.f0 = u_SpecularFactor;
    info.perceptualRoughness = u_GlossinessFactor;

#ifdef HAS_SPECULAR_GLOSSINESS_MAP
    vec4 sgSample = texture(u_SpecularGlossinessSampler, getSpecularGlossinessUV());
    info.perceptualRoughness *= sgSample.a ; // glossiness to roughness
    info.f0 *= sgSample.rgb; // specular
#endif // ! HAS_SPECULAR_GLOSSINESS_MAP

    info.perceptualRoughness = 1.0 - info.perceptualRoughness; // 1 - glossiness
    info.c_diff = info.baseColor.rgb * (1.0 - max(max(info.f0.r, info.f0.g), info.f0.b));
    return info;
}
#endif


#ifdef MATERIAL_METALLICROUGHNESS
MaterialInfo getMetallicRoughnessInfo(MaterialInfo info)
{
    info.metallic = u_MetallicFactor;
    info.perceptualRoughness = u_RoughnessFactor;

#ifdef HAS_METALLIC_ROUGHNESS_MAP
    // Roughness is stored in the 'g' channel, metallic is stored in the 'b' channel.
    // This layout intentionally reserves the 'r' channel for (optional) occlusion map data
    vec4 mrSample = texture(u_MetallicRoughnessSampler, getMetallicRoughnessUV());
    info.perceptualRoughness *= mrSample.g;
    info.metallic *= mrSample.b;
#endif

    // Achromatic f0 based on IOR.
    info.c_diff = mix(info.baseColor.rgb * (vec3(1.0) - info.f0),  vec3(0), info.metallic);
    info.f0 = mix(info.f0, info.baseColor.rgb, info.metallic);
    return info;
}
#endif


#ifdef MATERIAL_SHEEN
MaterialInfo getSheenInfo(MaterialInfo info)
{
    info.sheenColorFactor = u_SheenColorFactor;
    info.sheenRoughnessFactor = u_SheenRoughnessFactor;

#ifdef HAS_SHEEN_COLOR_MAP
    vec4 sheenColorSample = texture(u_SheenColorSampler, getSheenColorUV());
    info.sheenColorFactor *= sheenColorSample.rgb;
#endif

#ifdef HAS_SHEEN_ROUGHNESS_MAP
    vec4 sheenRoughnessSample = texture(u_SheenRoughnessSampler, getSheenRoughnessUV());
    info.sheenRoughnessFactor *= sheenRoughnessSample.a;
#endif
    return info;
}
#endif


#ifdef MATERIAL_SPECULAR
MaterialInfo getSpecularInfo(MaterialInfo info)
{   
    vec4 specularTexture = vec4(1.0);
#ifdef HAS_SPECULAR_MAP
    specularTexture.a = texture(u_SpecularSampler, getSpecularColorUV()).a;
#endif
#ifdef HAS_SPECULAR_COLOR_MAP
    specularTexture.rgb = texture(u_SpecularColorSampler, getSpecularUV()).rgb;
#endif

    vec3 dielectricSpecularF0 = min(info.f0 * u_KHR_materials_specular_specularColorFactor * specularTexture.rgb, vec3(1.0));
    info.f0 = mix(dielectricSpecularF0, info.baseColor.rgb, info.metallic);
    info.specularWeight = u_KHR_materials_specular_specularFactor * specularTexture.a;
    info.c_diff = mix(info.baseColor.rgb * (1.0 - max3(dielectricSpecularF0)),  vec3(0), info.metallic);
    return info;
}
#endif


#ifdef MATERIAL_TRANSMISSION
MaterialInfo getTransmissionInfo(MaterialInfo info)
{
    info.transmissionFactor = u_TransmissionFactor;

#ifdef HAS_TRANSMISSION_MAP
    vec4 transmissionSample = texture(u_TransmissionSampler, getTransmissionUV());
    info.transmissionFactor *= transmissionSample.r;
#endif
    return info;
}
#endif


#ifdef MATERIAL_VOLUME
MaterialInfo getVolumeInfo(MaterialInfo info)
{
    info.thickness = u_ThicknessFactor;
    info.attenuationColor = u_AttenuationColor;
    info.attenuationDistance = u_AttenuationDistance;

#ifdef HAS_THICKNESS_MAP
    vec4 thicknessSample = texture(u_ThicknessSampler, getThicknessUV());
    info.thickness *= thicknessSample.g;
#endif
    return info;
}
#endif


#ifdef MATERIAL_CLEARCOAT
MaterialInfo getClearCoatInfo(MaterialInfo info, NormalInfo normalInfo)
{
    info.clearcoatFactor = u_ClearcoatFactor;
    info.clearcoatRoughness = u_ClearcoatRoughnessFactor;
    info.clearcoatF0 = vec3(info.f0);
    info.clearcoatF90 = vec3(1.0);

#ifdef HAS_CLEARCOAT_MAP
    vec4 clearcoatSample = texture(u_ClearcoatSampler, getClearcoatUV());
    info.clearcoatFactor *= clearcoatSample.r;
#endif

#ifdef HAS_CLEARCOAT_ROUGHNESS_MAP
    vec4 clearcoatSampleRoughness = texture(u_ClearcoatRoughnessSampler, getClearcoatRoughnessUV());
    info.clearcoatRoughness *= clearcoatSampleRoughness.g;
#endif

    info.clearcoatNormal = getClearcoatNormal(normalInfo);
    info.clearcoatRoughness = clamp(info.clearcoatRoughness, 0.0, 1.0);
    return info;
}
#endif


#ifdef MATERIAL_IOR
MaterialInfo getIorInfo(MaterialInfo info)
{
    info.f0 = vec3(pow(( u_Ior - 1.0) /  (u_Ior + 1.0), 2.0));
    info.ior = u_Ior;
    return info;
}
#endif


float albedoSheenScalingLUT(float NdotV, float sheenRoughnessFactor)
{
    return texture(u_SheenELUT, vec2(NdotV, sheenRoughnessFactor)).r;
}
/********** /material-info.glsl.js **********/
`;

export default materialInfo;