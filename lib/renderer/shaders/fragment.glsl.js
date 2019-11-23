//
// This fragment shader defines a reference implementation for Physically Based Shading of
// a microfacet surface material defined by a glTF model.
//
// References:
// [1] Real Shading in Unreal Engine 4
//     http://blog.selfshadow.com/publications/s2013-shading-course/karis/s2013_pbs_epic_notes_v2.pdf
// [2] Physically Based Shading at Disney
//     http://blog.selfshadow.com/publications/s2012-shading-course/burley/s2012_pbs_disney_brdf_notes_v3.pdf
// [3] README.md - Environment Maps
//     https://github.com/KhronosGroup/glTF-WebGL-PBR/#environment-maps
// [4] "An Inexpensive BRDF Model for Physically based Rendering" by Christophe Schlick
//     https://www.cs.virginia.edu/~jdl/bib/appearance/analytic%20models/schlick94b.pdf

import { textures     } from './textures.glsl.js';
import { lighting     } from './lighting.glsl.js';
import { tonemapping  } from './tonemapping.glsl.js';


export const fragmentShader = /* glsl */`
/********** fragment.glsl.js **********/
precision highp float;

out vec4 g_finalColor;

uniform vec3 u_camera;
in vec3 v_position;

#ifdef HAS_NORMAL
  #ifdef HAS_TANGENT
    in mat3 v_tbn;
  #else
    in vec3 v_normal;
  #endif
#endif

#ifdef HAS_COLOR_0
  in vec4 v_color;
#endif

${textures}
${lighting}
${tonemapping}

vec4 getVertexColor() {
  vec4 color = vec4(1.0, 1.0, 1.0, 1.0);

  #ifdef COLOR_0_TYPE_VEC3
    color.rgb = v_color;
  #endif

  #ifdef COLOR_0_TYPE_VEC4
    color = v_color;
  #endif

  return color;
}

// Find the normal for this fragment, pulling either from a predefined normal map
// or from the interpolated mesh normal and tangent attributes.
vec3 getNormal() {
  vec2 UV = getNormalUV();

    // Retrieve the tangent space matrix
  #ifndef HAS_TANGENT
    vec3 pos_dx = dFdx(v_position);
    vec3 pos_dy = dFdy(v_position);
    vec3 tex_dx = dFdx(vec3(UV, 0.0));
    vec3 tex_dy = dFdy(vec3(UV, 0.0));
    vec3 t = (tex_dy.t * pos_dx - tex_dx.t * pos_dy) / (tex_dx.s * tex_dy.t - tex_dy.s * tex_dx.t);

    #ifdef HAS_NORMAL
      vec3 ng = normalize(v_normal);
    #else
      vec3 ng = cross(pos_dx, pos_dy);
    #endif

    t = normalize(t - ng * dot(ng, t));
    vec3 b = normalize(cross(ng, t));
    mat3 tbn = mat3(t, b, ng);
  #else
    mat3 tbn = v_tbn;
  #endif

  #ifdef HAS_NORMALTEXTURE
    vec3 n = texture(u_normalTexture, UV).rgb;
    n = normalize(tbn * ((2.0 * n - 1.0) * vec3(u_normalTexture_scale, u_normalTexture_scale, 1.0)));
  #else
    // The tbn matrix is linearly interpolated, so we need to re-normalize
    vec3 n = normalize(tbn[2].xyz);
  #endif

  #ifdef IS_DOUBLESIDED
    n *=  (2.0 * float(gl_FrontFacing) - 1.0);
  #endif

  return n;
}

vec3 getDefaultF0() {
  vec3 f0 = vec3(0.04);

  #ifdef HAS_KHR_MATERIALS_SPECULAR
    f0 = 0.08 * vec3(u_KHR_materials_specular_specularFactor);
    #ifdef HAS_KHR_MATERIALS_SPECULAR_SPECULARTEXTURE
      f0 *= SRGBtoLINEAR(texture(u_KHR_materials_specular_specularTexture, getKHRMaterialsSpecularUV())).a;
    #endif
  #endif

  return f0;
}

void main() {
  // Metallic and Roughness material properties are packed together
  // In glTF, these factors can be specified by fixed scalar values
  // or from a metallic-roughness map
  float perceptualRoughness = 0.0;
  float metallic = 0.0;
  vec4 baseColor = vec4(0.0, 0.0, 0.0, 1.0);
  vec3 diffuseColor = vec3(0.0);
  vec3 specularColor= vec3(0.0);
  vec3 f0 = getDefaultF0();

  vec4 output_color = baseColor;

  #ifdef HAS_KHR_MATERIALS_PBRSPECULARGLOSSINESS

    #ifdef HAS_KHR_MATERIALS_PBRSPECULARGLOSSINESS_SPECULARGLOSSINESSTEXTURE
      vec4 sgSample = SRGBtoLINEAR(texture(u_KHR_materials_pbrSpecularGlossiness_specularGlossinessTexture, getKHRMaterialsPBRSpecularGlossinessSpecularGlossinessUV()));
      perceptualRoughness = (1.0 - sgSample.a * u_KHR_materials_pbrSpecularGlossiness_glossinessFactor); // glossiness to roughness
      f0 = sgSample.rgb * u_KHR_materials_pbrSpecularGlossiness_specularFactor; // specular
    #else
      f0 = u_KHR_materials_pbrSpecularGlossiness_specularFactor;
      perceptualRoughness = 1.0 - u_KHR_materials_pbrSpecularGlossiness_glossinessFactor;
    #endif

    #ifdef HAS_KHR_MATERIALS_PBRSPECULARGLOSSINESS_DIFFUSETEXTURE
      baseColor = SRGBtoLINEAR(texture(u_KHR_materials_pbrSpecularGlossiness_diffuseTexture, getKHRMaterialsPBRSpecularGlossinessDiffuseUV())) * u_KHR_materials_pbrSpecularGlossiness_diffuseFactor;
    #else
      baseColor = u_KHR_materials_pbrSpecularGlossiness_diffuseFactor;
    #endif

    baseColor *= getVertexColor();

    // f0 = specular
    specularColor = f0;
    float oneMinusSpecularStrength = 1.0 - max(max(f0.r, f0.g), f0.b);
    diffuseColor = baseColor.rgb * oneMinusSpecularStrength;

    #ifdef DEBUG_METALLIC
      // do conversion between metallic M-R and S-G metallic
      metallic = solveMetallic(baseColor.rgb, specularColor, oneMinusSpecularStrength);
    #endif

  #else

    #ifdef HAS_METALLICROUGHNESSTEXTURE
      // Roughness is stored in the 'g' channel, metallic is stored in the 'b' channel.
      // This layout intentionally reserves the 'r' channel for (optional) occlusion map data
      vec4 mrSample = texture(u_metallicRoughnessTexture, getMetallicRoughnessUV());
      perceptualRoughness = mrSample.g * u_roughnessFactor;
      metallic = mrSample.b * u_metallicFactor;
    #else
      metallic = u_metallicFactor;
      perceptualRoughness = u_roughnessFactor;
    #endif

    // The albedo may be defined from a base texture or a flat color
    #ifdef HAS_BASECOLORTEXTURE
      baseColor = SRGBtoLINEAR(texture(u_baseColorTexture, getBaseColorUV())) * u_baseColorFactor;
    #else
      baseColor = u_baseColorFactor;
    #endif

    baseColor *= getVertexColor();

    diffuseColor = baseColor.rgb * (vec3(1.0) - f0) * (1.0 - metallic);

    specularColor = mix(f0, baseColor.rgb, metallic);

  #endif

  #ifdef ALPHAMODE_MASK
    if(baseColor.a < u_alphaCutoff) {
      discard;
    }
    baseColor.a = 1.0;
  #endif

  #ifdef ALPHAMODE_OPAQUE
    baseColor.a = 1.0;
  #endif

  #ifdef HAS_KHR_MATERIALS_UNLIT
    output_color = vec4(LINEARtoSRGB(baseColor.rgb), baseColor.a);
    return;
  #endif

  perceptualRoughness = clamp(perceptualRoughness, 0.0, 1.0);
  metallic = clamp(metallic, 0.0, 1.0);

  // Roughness is authored as perceptual roughness; as is convention,
  // convert to material roughness by squaring the perceptual roughness [2].
  float alphaRoughness = perceptualRoughness * perceptualRoughness;

  // Compute reflectance.
  float reflectance = max(max(specularColor.r, specularColor.g), specularColor.b);

  vec3 specularEnvironmentR0 = specularColor.rgb;
  // Anything less than 2% is physically impossible and is instead considered to be shadowing. Compare to "Real-Time-Rendering" 4th editon on page 325.
  vec3 specularEnvironmentR90 = vec3(clamp(reflectance * 50.0, 0.0, 1.0));

  MaterialInfo materialInfo = MaterialInfo(
    perceptualRoughness,
    specularEnvironmentR0,
    alphaRoughness,
    diffuseColor,
    specularEnvironmentR90,
    specularColor
  );

  // LIGHTING

  vec3 color = vec3(0.0, 0.0, 0.0);
  vec3 normal = getNormal();
  vec3 view = normalize(u_camera - v_position);

  vec3 emissive = vec3(0);
  #ifdef HAS_EMISSIVETEXTURE
    emissive = SRGBtoLINEAR(texture(u_emissiveTexture, getEmissiveUV())).rgb * u_emissiveTexture_emissiveFactor;
    color += emissive;
  #endif

  #ifdef USE_PUNCTUAL
    for (int i = 0; i < LIGHT_COUNT; ++i) {
      Light light = u_lights[i];
      if (light.type == LightType_Directional) {
        color += applyDirectionalLight(light, materialInfo, normal, view);
      } else if (light.type == LightType_Point) {
          color += applyPointLight(light, materialInfo, normal, view);
      } else if (light.type == LightType_Spot) {
        color += applySpotLight(light, materialInfo, normal, view);
      }
    }
  #endif

    // Calculate lighting contribution from image based lighting source (IBL)
  #ifdef USE_IBL
    color += getIBLContribution(materialInfo, normal, view);
  #endif

  float ao = 1.0;
  // Apply optional PBR terms for additional (optional) shading
  #ifdef HAS_OCCLUSIONTEXTURE
    ao = texture(u_occlusionTexture,  getOcclusionUV()).r;
    color = mix(color, color * ao, u_occlusionTexture_strength);
  #endif


  #ifndef DEBUG_OUTPUT // no debug

    // regular shading
    output_color = vec4(toneMap(color), baseColor.a);

  #else // debug output

    #ifdef DEBUG_METALLIC
      output_color.rgb = vec3(metallic);
    #endif

    #ifdef DEBUG_ROUGHNESS
      output_color.rgb = vec3(perceptualRoughness);
    #endif

    #ifdef DEBUG_NORMAL
      #ifdef HAS_NORMALTEXTURE
        output_color.rgb = texture(u_normalTexture, getNormalUV()).rgb;
      #else
        output_color.rgb = vec3(0.5, 0.5, 1.0);
      #endif
    #endif

    #ifdef DEBUG_BASECOLOR
      output_color.rgb = LINEARtoSRGB(baseColor.rgb);
    #endif

    #ifdef DEBUG_OCCLUSION
      output_color.rgb = vec3(ao);
    #endif

    #ifdef DEBUG_EMISSIVE
      output_color.rgb = LINEARtoSRGB(emissive);
    #endif

    #ifdef DEBUG_F0
      output_color.rgb = vec3(f0);
    #endif

    #ifdef DEBUG_ALPHA
      output_color.rgb = vec3(baseColor.a);
    #endif

    output_color.a = 1.0;

  #endif

  g_finalColor = output_color;
}
/********** /fragment.glsl.js **********/
`;

export default fragmentShader;
