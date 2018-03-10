// These shaders are temporarily borrowed directly from https://github.com/KhronosGroup/glTF-WebGL-PBR
// @todo: deconstruct this into something more managable and flexible.

import { Program } from './program.js';
import { mat4, vec3 } from '../../vendor/gl-matrix.js';

export const vertexShaderSrc = `
attribute vec3 a_Position;
#ifdef HAS_NORMALS
attribute vec3 a_Normal;
#endif
#ifdef HAS_TANGENTS
attribute vec4 a_Tangent;
#endif
#ifdef HAS_UV
attribute vec2 a_UV;
#endif
#ifdef HAS_VERTEXCOLORS
attribute vec4 a_VertexColor;
#endif

uniform mat4 u_MVPMatrix;
uniform mat4 u_ModelMatrix;
uniform mat4 u_NormalMatrix;

varying vec3 v_Position;
varying vec2 v_UV;

#ifdef HAS_NORMALS
#ifdef HAS_TANGENTS
varying mat3 v_TBN;
#else
varying vec3 v_Normal;
#endif
#endif

#ifdef HAS_VERTEXCOLORS
varying vec4 v_VertexColor;
#endif

#ifdef HAS_MORPHTARGETS

  uniform float u_MorphWeights[8];

  attribute vec3 a_MorphPosition0;
  attribute vec3 a_MorphPosition1;


  #ifdef HAS_MORPHNORMALS

    attribute vec3 a_MorphNormal0;
    attribute vec3 a_MorphNormal1;

    #ifdef HAS_MORPHTANGENTS

      attribute vec3 a_MorphTangent0;
      attribute vec3 a_MorphTangent1;

    #else

      attribute vec3 a_MorphPosition2;
      attribute vec3 a_MorphPosition3;

      attribute vec3 a_MorphNormal2;
      attribute vec3 a_MorphNormal3;

    #endif

  #else

    attribute vec3 a_MorphPosition2;
    attribute vec3 a_MorphPosition3;
    attribute vec3 a_MorphPosition4;
    attribute vec3 a_MorphPosition5;
    attribute vec3 a_MorphPosition6;
    attribute vec3 a_MorphPosition7;

  #endif

#endif

vec3 getMorphedPosition()
{
  vec3 morphed = vec3(0.0);

  #ifdef HAS_MORPHTARGETS

    morphed += u_MorphWeights[0] * a_MorphPosition0;
    morphed += u_MorphWeights[1] * a_MorphPosition1;

    #ifndef HAS_MORPHNORMALS

    morphed += u_MorphWeights[2] * a_MorphPosition2;
    morphed += u_MorphWeights[3] * a_MorphPosition3;
    morphed += u_MorphWeights[4] * a_MorphPosition4;
    morphed += u_MorphWeights[5] * a_MorphPosition5;
    morphed += u_MorphWeights[6] * a_MorphPosition6;
    morphed += u_MorphWeights[7] * a_MorphPosition7;

    #else

      #ifndef HAS_MORPHTANGENTS

      morphed += u_MorphWeights[2] * a_MorphPosition2;
      morphed += u_MorphWeights[3] * a_MorphPosition3;

      #endif

    #endif

  #endif

  return morphed;
}

vec3 getMorphedNormal()
{
  vec3 morphed = vec3(0.0);

  #ifdef HAS_MORPHNORMALS

  morphed += u_MorphWeights[0] * a_MorphNormal0;
  morphed += u_MorphWeights[1] * a_MorphNormal1;

    #ifndef HAS_MORPHTANGENTS

    morphed += u_MorphWeights[2] * a_MorphNormal2;
    morphed += u_MorphWeights[3] * a_MorphNormal3;

    #endif

  #endif

  return morphed;
}

vec3 getMorphedTangent(){
  vec3 morphed = vec3(0.0);
  #ifdef HAS_MORPHTANGENTS
    morphed += u_MorphWeights[0] * a_MorphTangent0;
    morphed += u_MorphWeights[1] * a_MorphTangent1;
  #endif
  return morphed;
}


void main()
{
  vec4 morph = vec4(a_Position + getMorphedPosition(), 1.0);
  vec4 pos = u_ModelMatrix * morph;
  v_Position = (vec3(pos.xyz) / pos.w);

  #ifdef HAS_NORMALS
    vec3 normal = a_Normal + getMorphedNormal();

    #ifdef HAS_TANGENTS
      vec4 tangent = a_Tangent + vec4(getMorphedTangent(), 0);

      vec3 normalW = normalize(vec3(u_NormalMatrix * vec4(normal, 0.0)));
      vec3 tangentW = normalize(vec3(u_ModelMatrix * vec4(tangent.xyz, 0.0)));
      vec3 bitangentW = cross(normalW, tangentW) * tangent.w;
      v_TBN = mat3(tangentW, bitangentW, normalW);
    #else // HAS_TANGENTS != 1
      v_Normal = normalize(vec3(u_ModelMatrix * vec4(normal, 0.0)));
    #endif
  #endif

  #ifdef HAS_UV
  v_UV = a_UV;
  #else
  v_UV = vec2(0.,0.);
  #endif

  #ifdef HAS_VERTEXCOLORS
  v_VertexColor = a_VertexColor;
  #endif

  gl_Position = u_MVPMatrix * morph; // needs w for proper perspective correction
}
`;

export const fragmentShaderSrc = `
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
#extension GL_EXT_shader_texture_lod: enable
#extension GL_OES_standard_derivatives : enable

precision highp float;

uniform vec3 u_LightDirection;
uniform vec3 u_LightColor;

#ifdef USE_IBL
uniform samplerCube u_DiffuseEnvSampler;
uniform samplerCube u_SpecularEnvSampler;
uniform sampler2D u_brdfLUT;
#endif

#ifdef HAS_BASECOLORMAP
uniform sampler2D u_BaseColorSampler;
#endif
#ifdef HAS_NORMALMAP
uniform sampler2D u_NormalSampler;
uniform float u_NormalScale;
#endif
#ifdef HAS_EMISSIVEMAP
uniform sampler2D u_EmissiveSampler;
uniform vec3 u_EmissiveFactor;
#endif
#ifdef HAS_METALROUGHNESSMAP
uniform sampler2D u_MetallicRoughnessSampler;
#endif
#ifdef HAS_OCCLUSIONMAP
uniform sampler2D u_OcclusionSampler;
uniform float u_OcclusionStrength;
#endif

uniform vec2 u_MetallicRoughnessValues;
uniform vec4 u_BaseColorFactor;

uniform vec3 u_Camera;

// debugging flags used for shader output of intermediate PBR variables
uniform vec4 u_ScaleDiffBaseMR;
uniform vec4 u_ScaleFGDSpec;
uniform vec4 u_ScaleIBLAmbient;

varying vec3 v_Position;

varying vec2 v_UV;

#ifdef HAS_NORMALS
#ifdef HAS_TANGENTS
varying mat3 v_TBN;
#else
varying vec3 v_Normal;
#endif
#endif

#ifdef HAS_VERTEXCOLORS
varying vec4 v_VertexColor;
#endif

// Encapsulate the various inputs used by the various functions in the shading equation
// We store values in this struct to simplify the integration of alternative implementations
// of the shading terms, outlined in the Readme.MD Appendix.
struct PBRInfo
{
    float NdotL;                  // cos angle between normal and light direction
    float NdotV;                  // cos angle between normal and view direction
    float NdotH;                  // cos angle between normal and half vector
    float LdotH;                  // cos angle between light direction and half vector
    float VdotH;                  // cos angle between view direction and half vector
    float perceptualRoughness;    // roughness value, as authored by the model creator (input to shader)
    float metalness;              // metallic value at the surface
    vec3 reflectance0;            // full reflectance color (normal incidence angle)
    vec3 reflectance90;           // reflectance color at grazing angle
    float alphaRoughness;         // roughness mapped to a more linear change in the roughness (proposed by [2])
    vec3 diffuseColor;            // color contribution from diffuse lighting
    vec3 specularColor;           // color contribution from specular lighting
};

const float M_PI = 3.141592653589793;
const float c_MinRoughness = 0.04;

vec4 SRGBtoLINEAR(vec4 srgbIn)
{
    #ifdef MANUAL_SRGB
    #ifdef SRGB_FAST_APPROXIMATION
    vec3 linOut = pow(srgbIn.xyz,vec3(2.2));
    #else //SRGB_FAST_APPROXIMATION
    vec3 bLess = step(vec3(0.04045),srgbIn.xyz);
    vec3 linOut = mix( srgbIn.xyz/vec3(12.92), pow((srgbIn.xyz+vec3(0.055))/vec3(1.055),vec3(2.4)), bLess );
    #endif //SRGB_FAST_APPROXIMATION
    return vec4(linOut,srgbIn.w);;
    #else //MANUAL_SRGB
    return srgbIn;
    #endif //MANUAL_SRGB
}

// Find the normal for this fragment, pulling either from a predefined normal map
// or from the interpolated mesh normal and tangent attributes.
vec3 getNormal()
{
    // Retrieve the tangent space matrix
#ifndef HAS_TANGENTS
    vec3 pos_dx = dFdx(v_Position);
    vec3 pos_dy = dFdy(v_Position);
    vec3 tex_dx = dFdx(vec3(v_UV, 0.0));
    vec3 tex_dy = dFdy(vec3(v_UV, 0.0));
    vec3 t = (tex_dy.t * pos_dx - tex_dx.t * pos_dy) / (tex_dx.s * tex_dy.t - tex_dy.s * tex_dx.t);

#ifdef HAS_NORMALS
    vec3 ng = normalize(v_Normal);
#else
    vec3 ng = cross(pos_dx, pos_dy);
#endif

    t = normalize(t - ng * dot(ng, t));
    vec3 b = normalize(cross(ng, t));
    mat3 tbn = mat3(t, b, ng);
#else // HAS_TANGENTS
    mat3 tbn = v_TBN;
#endif

#ifdef HAS_NORMALMAP
    vec3 n = texture2D(u_NormalSampler, v_UV).rgb;
    n = normalize(tbn * ((2.0 * n - 1.0) * vec3(u_NormalScale, u_NormalScale, 1.0)));
#else
    // The tbn matrix is linearly interpolated, so we need to re-normalize
    vec3 n = normalize(tbn[2].xyz);
#endif

#ifdef IS_DOUBLESIDED
    if(gl_FrontFacing == false) {
      n = n * -1.0;
    }
#endif

    return n;
}

#ifdef USE_IBL
// Calculation of the lighting contribution from an optional Image Based Light source.
// Precomputed Environment Maps are required uniform inputs and are computed as outlined in [1].
// See our README.md on Environment Maps [3] for additional discussion.
vec3 getIBLContribution(PBRInfo pbrInputs, vec3 n, vec3 reflection)
{
    float mipCount = 9.0; // resolution of 512x512
    float lod = (pbrInputs.perceptualRoughness * mipCount);
    // retrieve a scale and bias to F0. See [1], Figure 3
    vec3 brdf = SRGBtoLINEAR(texture2D(u_brdfLUT, vec2(pbrInputs.NdotV, 1.0 - pbrInputs.perceptualRoughness))).rgb;
    vec3 diffuseLight = SRGBtoLINEAR(textureCube(u_DiffuseEnvSampler, n)).rgb;

#ifdef USE_TEX_LOD
    vec3 specularLight = SRGBtoLINEAR(textureCubeLodEXT(u_SpecularEnvSampler, reflection, lod)).rgb;
#else
    vec3 specularLight = SRGBtoLINEAR(textureCube(u_SpecularEnvSampler, reflection)).rgb;
#endif

    vec3 diffuse = diffuseLight * pbrInputs.diffuseColor;
    vec3 specular = specularLight * (pbrInputs.specularColor * brdf.x + brdf.y);

    // For presentation, this allows us to disable IBL terms
    diffuse *= u_ScaleIBLAmbient.x;
    specular *= u_ScaleIBLAmbient.y;

    return diffuse + specular;
}
#endif

// Basic Lambertian diffuse
// Implementation from Lambert's Photometria https://archive.org/details/lambertsphotome00lambgoog
// See also [1], Equation 1
vec3 diffuse(PBRInfo pbrInputs)
{
    return pbrInputs.diffuseColor / M_PI;
}

// The following equation models the Fresnel reflectance term of the spec equation (aka F())
// Implementation of fresnel from [4], Equation 15
vec3 specularReflection(PBRInfo pbrInputs)
{
    return pbrInputs.reflectance0 + (pbrInputs.reflectance90 - pbrInputs.reflectance0) * pow(clamp(1.0 - pbrInputs.VdotH, 0.0, 1.0), 5.0);
}

// This calculates the specular geometric attenuation (aka G()),
// where rougher material will reflect less light back to the viewer.
// This implementation is based on [1] Equation 4, and we adopt their modifications to
// alphaRoughness as input as originally proposed in [2].
float geometricOcclusion(PBRInfo pbrInputs)
{
    float NdotL = pbrInputs.NdotL;
    float NdotV = pbrInputs.NdotV;
    float r = pbrInputs.alphaRoughness;

    float attenuationL = 2.0 * NdotL / (NdotL + sqrt(r * r + (1.0 - r * r) * (NdotL * NdotL)));
    float attenuationV = 2.0 * NdotV / (NdotV + sqrt(r * r + (1.0 - r * r) * (NdotV * NdotV)));
    return attenuationL * attenuationV;
}

// The following equation(s) model the distribution of microfacet normals across the area being drawn (aka D())
// Implementation from "Average Irregularity Representation of a Roughened Surface for Ray Reflection" by T. S. Trowbridge, and K. P. Reitz
// Follows the distribution function recommended in the SIGGRAPH 2013 course notes from EPIC Games [1], Equation 3.
float microfacetDistribution(PBRInfo pbrInputs)
{
    float roughnessSq = pbrInputs.alphaRoughness * pbrInputs.alphaRoughness;
    float f = (pbrInputs.NdotH * roughnessSq - pbrInputs.NdotH) * pbrInputs.NdotH + 1.0;
    return roughnessSq / (M_PI * f * f);
}

void main()
{
    // Metallic and Roughness material properties are packed together
    // In glTF, these factors can be specified by fixed scalar values
    // or from a metallic-roughness map
    float perceptualRoughness = u_MetallicRoughnessValues.y;
    float metallic = u_MetallicRoughnessValues.x;
#ifdef HAS_METALROUGHNESSMAP
    // Roughness is stored in the 'g' channel, metallic is stored in the 'b' channel.
    // This layout intentionally reserves the 'r' channel for (optional) occlusion map data
    vec4 mrSample = texture2D(u_MetallicRoughnessSampler, v_UV);
    perceptualRoughness = mrSample.g * perceptualRoughness;
    metallic = mrSample.b * metallic;
#endif
    perceptualRoughness = clamp(perceptualRoughness, c_MinRoughness, 1.0);
    metallic = clamp(metallic, 0.0, 1.0);
    // Roughness is authored as perceptual roughness; as is convention,
    // convert to material roughness by squaring the perceptual roughness [2].
    float alphaRoughness = perceptualRoughness * perceptualRoughness;

    // The albedo may be defined from a base texture or a flat color
#ifdef HAS_BASECOLORMAP
    vec4 baseColor = SRGBtoLINEAR(texture2D(u_BaseColorSampler, v_UV)) * u_BaseColorFactor;
#else
    vec4 baseColor = u_BaseColorFactor;
#endif


#ifdef HAS_VERTEXCOLORS
    baseColor *= v_VertexColor;
#endif

    vec3 f0 = vec3(0.04);
    vec3 diffuseColor = baseColor.rgb * (vec3(1.0) - f0);
    diffuseColor *= 1.0 - metallic;
    vec3 specularColor = mix(f0, baseColor.rgb, metallic);


    // Compute reflectance.
    float reflectance = max(max(specularColor.r, specularColor.g), specularColor.b);

    // For typical incident reflectance range (between 4% to 100%) set the grazing reflectance to 100% for typical fresnel effect.
    // For very low reflectance range on highly diffuse objects (below 4%), incrementally reduce grazing reflecance to 0%.
    float reflectance90 = clamp(reflectance * 25.0, 0.0, 1.0);
    vec3 specularEnvironmentR0 = specularColor.rgb;
    vec3 specularEnvironmentR90 = vec3(1.0, 1.0, 1.0) * reflectance90;

    vec3 n = getNormal();                             // normal at surface point
    vec3 v = normalize(u_Camera - v_Position);        // Vector from surface point to camera
    vec3 l = normalize(u_LightDirection);             // Vector from surface point to light
    vec3 h = normalize(l+v);                          // Half vector between both l and v
    vec3 reflection = -normalize(reflect(v, n));

    float NdotL = clamp(dot(n, l), 0.001, 1.0);
    float NdotV = abs(dot(n, v)) + 0.001;
    float NdotH = clamp(dot(n, h), 0.0, 1.0);
    float LdotH = clamp(dot(l, h), 0.0, 1.0);
    float VdotH = clamp(dot(v, h), 0.0, 1.0);

    PBRInfo pbrInputs = PBRInfo(
        NdotL,
        NdotV,
        NdotH,
        LdotH,
        VdotH,
        perceptualRoughness,
        metallic,
        specularEnvironmentR0,
        specularEnvironmentR90,
        alphaRoughness,
        diffuseColor,
        specularColor
    );

    // Calculate the shading terms for the microfacet specular shading model
    vec3 F = specularReflection(pbrInputs);
    float G = geometricOcclusion(pbrInputs);
    float D = microfacetDistribution(pbrInputs);

    // Calculation of analytical lighting contribution
    vec3 diffuseContrib = (1.0 - F) * diffuse(pbrInputs);
    vec3 specContrib = F * G * D / (4.0 * NdotL * NdotV);
    // Obtain final intensity as reflectance (BRDF) scaled by the energy of the light (cosine law)
    vec3 color = NdotL * u_LightColor * (diffuseContrib + specContrib);

    // Calculate lighting contribution from image based lighting source (IBL)
#ifdef USE_IBL
    color += getIBLContribution(pbrInputs, n, reflection);
#endif

    // Apply optional PBR terms for additional (optional) shading
#ifdef HAS_OCCLUSIONMAP
    float ao = texture2D(u_OcclusionSampler, v_UV).r;
    color = mix(color, color * ao, u_OcclusionStrength);
#endif

#ifdef HAS_EMISSIVEMAP
    vec3 emissive = SRGBtoLINEAR(texture2D(u_EmissiveSampler, v_UV)).rgb * u_EmissiveFactor;
    color += emissive;
#endif

    // This section uses mix to override final color for reference app visualization
    // of various parameters in the lighting equation.
    // color = mix(color, F, u_ScaleFGDSpec.x);
    // color = mix(color, vec3(G), u_ScaleFGDSpec.y);
    // color = mix(color, vec3(D), u_ScaleFGDSpec.z);
    // color = mix(color, specContrib, u_ScaleFGDSpec.w);

    // color = mix(color, diffuseContrib, u_ScaleDiffBaseMR.x);
    // color = mix(color, baseColor.rgb, u_ScaleDiffBaseMR.y);
    // color = mix(color, vec3(metallic), u_ScaleDiffBaseMR.z);
    // color = mix(color, vec3(perceptualRoughness), u_ScaleDiffBaseMR.w);

    gl_FragColor = vec4(pow(color,vec3(1.0/2.2)), baseColor.a);
}
`;

function setAttribute(attribute, accessor, contextMap) {
  const { bufferView: { componentType, byteStride }, normalized, numberOfComponents, byteOffset } = accessor;
  const buffer = contextMap.get(accessor.bufferView);
  attribute.set(buffer, numberOfComponents, componentType, normalized, byteStride, byteOffset);
}

/**
 * A standard physically based rendering program.
 *
 * @todo: decouple the WebGLTF Pirmitive structure from this?
 */
export class PBRProgram extends Program {
  /**
   * Creates an instance of PBRProgram from a {@link Primitive}.
   * @param {Object} params - The PBRProgram parameters.
   * @param {WebGLRenderingContext} params.context - The WebGL context to create the shader with.
   * @param {Primitve} params.primitive - The Primitive to create the program from.
   */
  constructor({ context, primitive }) {
    const { targets } = primitive;

    const {
      pbrMetallicRoughness = {},
      normalTexture, occlusionTexture, emissiveTexture, doubleSided,
    } = primitive.material || {};

    const {
      baseColorTexture, metallicRoughnessTexture,
    } = pbrMetallicRoughness;

    const { NORMAL, TANGENT, TEXCOORD_0, COLOR_0 } = primitive.attributes;
    const define = {
      HAS_NORMALS: NORMAL ? 1 : 0,
      HAS_TANGENTS: TANGENT ? 1 : 0,
      HAS_UV: TEXCOORD_0 ? 1 : 0,
      HAS_VERTEXCOLORS: COLOR_0 ? 1 : 0,
      HAS_NORMALMAP: normalTexture ? 1 : 0,
      HAS_OCCLUSIONMAP: occlusionTexture ? 1 : 0,
      HAS_EMISSIVEMAP: emissiveTexture ? 1 : 0,
      HAS_BASECOLORMAP: baseColorTexture ? 1 : 0,
      HAS_METALROUGHNESSMAP: metallicRoughnessTexture ? 1 : 0,
      HAS_MORPHTARGETS: targets ? 1 : 0,
      HAS_MORPHNORMALS: targets && targets[0].NORMAL ? 1 : 0,
      HAS_MORPHTANGENTS: targets && targets[0].TANGENT ? 1 : 0,
      IS_DOUBLESIDED: doubleSided ? 1 : 0,
    };

    for (const [key, value] of Object.entries(define)) {
      if (!value) delete define[key];
    }

    super({ context, vertexShaderSrc, fragmentShaderSrc, define });
  }

  run(primitive, cameraTranslate, modelMatrix, mvpMatrix, contextMap, weights) {
    this.use();

    const { context: gl } = this;

    this.uniforms['u_Camera'].set(cameraTranslate);
    this.uniforms['u_ModelMatrix'].set(modelMatrix);
    this.uniforms['u_MVPMatrix'].set(mvpMatrix);

    const { targets = [] } = primitive;
    if (weights) this.uniforms['u_MorphWeights[0]'].set(weights);

    for (let t = 0; t < targets.length; t++) {
      if (targets[t].POSITION) setAttribute(this.attributes[`a_MorphPosition${t}`], targets[t].POSITION, contextMap);
      if (targets[t].NORMAL) setAttribute(this.attributes[`a_MorphNormal${t}`], targets[t].NORMAL, contextMap);
      if (targets[t].TANGENT) setAttribute(this.attributes[`a_MorphTangent${t}`], targets[t].TANGENT, contextMap);
    }

    const { POSITION, NORMAL, TANGENT, TEXCOORD_0, COLOR_0 } = primitive.attributes;

    const {
      pbrMetallicRoughness = {},
      normalTexture, occlusionTexture, emissiveTexture, emissiveFactor, doubleSided,
    } = primitive.material || {};

    const {
      baseColorFactor = [1, 1, 1, 1], metallicFactor = 1, roughnessFactor = 1,
      baseColorTexture, metallicRoughnessTexture,
    } = pbrMetallicRoughness;

    this.uniforms['u_BaseColorFactor'].set(baseColorFactor);
    this.uniforms['u_MetallicRoughnessValues'].set([metallicFactor, roughnessFactor]);

    setAttribute(this.attributes['a_Position'], POSITION, contextMap);

    if (this.define['HAS_NORMALS']) {
      setAttribute(this.attributes['a_Normal'], NORMAL, contextMap);

      if (this.define['HAS_TANGENTS']) {
        setAttribute(this.attributes['a_Tangent'], TANGENT, contextMap);
        const modelInverse = mat4.create();
        const normalMatrix = mat4.create();

        mat4.invert(modelInverse, modelMatrix);
        mat4.transpose(normalMatrix, modelInverse);

        this.uniforms['u_NormalMatrix'].set(normalMatrix);
      }
    }
    if (this.define['HAS_UV']) {
      setAttribute(this.attributes['a_UV'], TEXCOORD_0, contextMap);
    }

    if (this.define['HAS_VERTEXCOLORS']) {
      setAttribute(this.attributes['a_VertexColor'], COLOR_0, contextMap);
    }

    if (this.define['HAS_NORMALMAP']) {
      this.uniforms['u_NormalSampler'].set(contextMap.get(normalTexture));
      this.uniforms['u_NormalScale'].set(normalTexture.scale);
    }
    if (this.define['HAS_OCCLUSIONMAP']) {
      this.uniforms['u_OcclusionSampler'].set(contextMap.get(occlusionTexture));
      this.uniforms['u_OcclusionStrength'].set(occlusionTexture.strength);
    }
    if (this.define['HAS_EMISSIVEMAP']) {
      this.uniforms['u_EmissiveSampler'].set(contextMap.get(emissiveTexture));
      this.uniforms['u_EmissiveFactor'].set(emissiveFactor);
    }
    if (this.define['HAS_BASECOLORMAP']) {
      this.uniforms['u_BaseColorSampler'].set(contextMap.get(baseColorTexture));
    }
    if (this.define['HAS_METALROUGHNESSMAP']) {
      this.uniforms['u_MetallicRoughnessSampler'].set(contextMap.get(metallicRoughnessTexture));
    }

    // temporary lighting
    this.uniforms['u_LightColor'].set(vec3.fromValues(1, 1, 1));
    this.uniforms['u_LightDirection'].set(vec3.fromValues(0, 1, 1));

    if (!doubleSided) {
      this.context.enable(this.context.CULL_FACE);
    } else {
      this.context.disable(this.context.CULL_FACE);
    }

    if (primitive.indices) {
      const { bufferView, count, componentType, byteOffset } = primitive.indices;
      gl.bindBuffer(this.context.ELEMENT_ARRAY_BUFFER, contextMap.get(bufferView));
      gl.drawElements(primitive.mode, count, componentType, byteOffset);
    } else {
      /**
       * If indices is not defined use drawArrays instead with a count from any of the attributes. They should all be the same.
       * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#meshes
       */
      const { count } = Object.values(primitive.attributes)[0];
      gl.drawArrays(primitive.mode, 0, count);
    }
  }
}

export default PBRProgram;
