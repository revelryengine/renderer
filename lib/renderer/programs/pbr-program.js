import { Program  } from './program.js';

import { vertexShader   } from '../shaders/primitive.vert.js';
import { fragmentShader } from '../shaders/pbr.frag.js';

/**
 * Series of helper functions for translating glTF spec names to match their shader equivalents.
 */
function capitalizeFirst(str) {
  return str.slice(0, 1).toUpperCase() + str.slice(1);
}

function hasTextureDefine(name) {
  return `HAS_${name.replaceAll(/([A-Z])/g, "_$1").replace(/Texture$/, 'MAP').toUpperCase()}`;
}

function hasUVTransformDefine(name) {
  return `HAS_${name.replace(/Texture$/, '_UV_TRANSFORM').toUpperCase()}`;
}

function hasAttributeDefine(name, { type }) {
  return `HAS_${name.toUpperCase()}_${type.toUpperCase()}`;
}

function hasTargetDefine(name, i, { type }) {
  return `HAS_TARGET_${name}${i}_${type.toUpperCase()}`;
}

function textureUniformName(name) {
  return `u_${capitalizeFirst(name).replace(/Texture$/, '')}`;
}

function textureSamplerUniform(name) {
  return `${textureUniformName(name)}Sampler`;
}

function textureUVSetUniform(name) {
  return `${textureUniformName(name)}UVSet`;
}

function primitiveAttribute(name) {
  return `a_${name.toLowerCase()}`;
}

function targetAttribute(name, i) {
  return `a_target_${name.toLowerCase()}${i}`;
}


export const DEBUG_DEFINES = {
  ...Object.fromEntries([
    'DEBUG_NONE',
    'DEBUG_NORMAL',
    'DEBUG_NORMAL_WORLD',
    'DEBUG_NORMAL_GEOMETRY',
    'DEBUG_NORMAL_VIEW',
    'DEBUG_TANGENT',
    'DEBUG_BITANGENT',
    'DEBUG_ROUGHNESS',
    'DEBUG_METALLIC',
    'DEBUG_BASE_COLOR_SRGB',
    'DEBUG_BASE_COLOR_LINEAR',
    'DEBUG_OCCLUSION',
    'DEBUG_EMISSIVE_SRGB',
    'DEBUG_EMISSIVE_LINEAR',
    'DEBUG_F0',
    'DEBUG_ALPHA',
    'DEBUG_DIFFUSE_SRGB',
    'DEBUG_SPECULAR_SRGB',
    'DEBUG_CLEARCOAT_SRGB',
    'DEBUG_SHEEN_SRGB',
    'DEBUG_TRANSMISSION_SRGB',
  ].map((name, i) => [name, i])),
  DEBUG: 'DEBUG_NONE',
}

/**
 * A standard physically based rendering program.
 */
export class PBRProgram extends Program {
  static vertexShaderSrc   = vertexShader;
  static fragmentShaderSrc = fragmentShader;

  /**
   * Creates an instance of PBRProgram from a {@link Primitive}.
   * @param {WebGLRenderingContext} context - The WebGL Rendering Context.
   * @param {Object} params - The PBRProgram parameters
   */
  constructor(context, primitive, node, graph, additionalDefines = {}) {
    const { attributes, targets = [] } = primitive;

    const { ibl, punctual, ssao, debug } = graph.settings;

    const lightCount  = graph.lights.length;
    const jointCount  = node.skin?.joints?.length;
    const weightCount = node.mesh?.weights?.length;

    const material = primitive.getMaterial(context);
    
    const defines = {
      USE_IBL:      graph.environment && ibl.enabled ? 1 : null,
      USE_PUNCTUAL: graph.lights.length && punctual.enabled ? 1 : null,
      USE_SSAO:     ssao.enabled ? 1 : null,
      
      USE_MORPHING: weightCount > 0 ? 1 : null,
      USE_SKINNING: jointCount  > 0 ? 1 : null,

      WEIGHT_COUNT: weightCount > 0 ? weightCount : null,
      JOINT_COUNT:  jointCount  > 0 ? jointCount  : null,
      LIGHT_COUNT:  lightCount  > 0 ? lightCount  : null,

      ...DEBUG_DEFINES,
      ...additionalDefines,

      DEBUG: debug || 'DEBUG_NONE',
    };

    PBRProgram.defineMaterial(defines, material);

    const maxAttributes = context.getParameter(context.MAX_VERTEX_ATTRIBS);
    let attributeCount = 0;
    for(const name of Object.keys(attributes)) {
      if(attributeCount++ < maxAttributes) defines[hasAttributeDefine(name, attributes[name])] = 1;
    }

    for(let i = 0; i < targets.length; i++) {
      for(const name of ['NORMAL', 'POSITION', 'TANGENT']) {
        if(targets[i][name] && attributeCount++ < maxAttributes) defines[hasTargetDefine(name, i, targets[i][name])] = 1;
      }
    }

    for (const [key, value] of Object.entries(defines)) {
      if (value === null) delete defines[key];
    }

    super(context, defines);
  }

  run(primitive, node, graph) {
    super.run();

    const modelMatrix         = graph.getWorldTransform(node);
    const normalMatrix        = graph.getNormalMatrix(node);
    const jointMatrices       = graph.getJointMatrices(node);
    const jointNormalMatrices = graph.getJointNormalMatrices(node);

    const { weights: morphWeights = node.mesh.weights } = node;

    const { lights, environment } = graph;
    const { cameraPosition, viewMatrix, projectionMatrix, viewProjectionMatrix } = graph.viewInfo;

    const { context } = this;

    this.uniforms.set('u_Camera', cameraPosition);
    this.uniforms.set('u_Exposure', 1);
    this.uniforms.set('u_Lights', lights);

    this.uniforms.set('u_ModelMatrix', modelMatrix);
    this.uniforms.set('u_ViewMatrix', viewMatrix);
    this.uniforms.set('u_ProjectionMatrix', projectionMatrix);
    this.uniforms.set('u_ViewProjectionMatrix', viewProjectionMatrix);
    this.uniforms.set('u_NormalMatrix', normalMatrix);

    this.uniforms.set('u_jointMatrix', jointMatrices);
    this.uniforms.set('u_jointNormalMatrix', jointNormalMatrices);
    this.uniforms.set('u_morphWeights', morphWeights);
    
    const { indices, attributes, mode, targets = [] } = primitive;

    const material = primitive.getMaterial(context);

    this.applyMaterial(context, material, graph);  
    
    for(const name in attributes) {
      const attr = attributes[name];
      this.attributes.set(primitiveAttribute(name), attr);
    }

    for(let i = 0; i < targets.length; i++) {
      for(const name of ['NORMAL', 'POSITION', 'TANGENT']) {
        if(targets[i][name]) this.attributes.set(targetAttribute(name, i), targets[i][name]);
      }
    }

    if (environment) {
      this.uniforms.set('u_MipCount',   environment.mipCount);
      
      this.uniforms.set('u_GGXLUT',     environment.lutTexture.getWebGLTexture(context));
      this.uniforms.set('u_SheenELUT',  environment.lutSheenETexture.getWebGLTexture(context));
      this.uniforms.set('u_CharlieLUT', environment.lutCharlieTexture.getWebGLTexture(context));

      this.uniforms.set('u_GGXEnvSampler',        environment.envGGXTexture.getWebGLTexture(context));
      this.uniforms.set('u_LambertianEnvSampler', environment.envLambertianTexture.getWebGLTexture(context));
      this.uniforms.set('u_CharlieEnvSampler',    environment.envCharlieTexture.getWebGLTexture(context));

      this.uniforms.set('u_EnvRotation', environment.rotation);
    }
    
    this.uniforms.set('u_SSAOSampler', graph.passes['ssao:final']?.textures?.color);
    this.uniforms.set('u_ViewportDimensions', [graph.viewInfo.viewport.width, graph.viewInfo.viewport.height]);

    this.update();

    if (indices) {
      const { count, componentType } = indices;
      context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, indices.getWebGLBuffer(context, context.ELEMENT_ARRAY_BUFFER));
      context.drawElements(mode, count, componentType, 0);
    } else {
      /**
       * If indices is not defined use drawArrays instead with a count from any of the attributes. They should all be the same.
       * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#meshes
       */
      const { count } = Object.values(attributes)[0];
      context.drawArrays(mode, 0, count);
    }
  }

  static defineMaterial(defines, material = {}) {
    const {
      alphaMode = 'OPAQUE',
      pbrMetallicRoughness = {},
      normalTexture, occlusionTexture, emissiveTexture,
    } = material;

    const {
      baseColorTexture, metallicRoughnessTexture
    } = pbrMetallicRoughness;

    const textures = { normalTexture, occlusionTexture, emissiveTexture, baseColorTexture, metallicRoughnessTexture };

    for(const name in textures){
      const texture = textures[name];
      if(texture) {
        PBRProgram.defineTexture(defines, texture, name);
      } 
    }

    Object.assign(defines, {
      ALPHAMODE_OPAQUE: 0,
      ALPHAMODE_MASK: 1,
      ALPHAMODE_BLEND: 2,
      ALPHAMODE: `ALPHAMODE_${alphaMode}`,
      MATERIAL_METALLICROUGHNESS: 1
    });

    // Check if any extensions want to set define anything for the program
    for(const name in material.extensions) {
      material.extensions[name]?.defineMaterial?.(this, defines, material);
    }
  }

  static defineTexture(defines, texture, name) {
    defines[hasTextureDefine(name)] = 1;

    if(texture.extensions.KHR_texture_transform) {
      defines[hasUVTransformDefine(name)] = 1;
    }
  }

  applyMaterial(context, material = {}, graph) {
    const {
      pbrMetallicRoughness = {},
      normalTexture, occlusionTexture, emissiveTexture, emissiveFactor, doubleSided, alphaMode, alphaCutoff
    } = material;

    const {
      baseColorFactor = [1, 1, 1, 1], metallicFactor = 1, roughnessFactor = 1, baseColorTexture, metallicRoughnessTexture
    } = pbrMetallicRoughness;

    this.uniforms.set('u_BaseColorFactor', baseColorFactor);
    this.uniforms.set('u_MetallicFactor',  metallicFactor);
    this.uniforms.set('u_RoughnessFactor', roughnessFactor);
    this.uniforms.set('u_EmissiveFactor',  emissiveFactor);
    this.uniforms.set('u_AlphaCutoff',     alphaCutoff);

    const textures = { normalTexture, occlusionTexture, emissiveTexture, baseColorTexture, metallicRoughnessTexture };
    
    for(const name in textures){
      const texture = textures[name];
      if(texture) {
        this.applyTexture(context, texture, name);
      } 
    }

    if(normalTexture) {
      this.uniforms.set('u_NormalScale', normalTexture.scale);
    } 
    if(occlusionTexture) {
      this.uniforms.set('u_OcclusionStrength', occlusionTexture.strength);
    }

    if (doubleSided) {
      context.disable(context.CULL_FACE);
    } else {
      context.enable(context.CULL_FACE);
    }

    if(alphaMode === 'BLEND') {
      context.enable(context.BLEND);
      context.blendFuncSeparate(context.SRC_ALPHA, context.ONE_MINUS_SRC_ALPHA, context.ONE, context.ONE_MINUS_SRC_ALPHA);
      context.blendEquation(context.FUNC_ADD);
    } else {
      context.disable(context.BLEND);
    }

    // Check if any extensions want to apply anything to the program
    for(const name in material.extensions) {
      material.extensions[name]?.applyMaterial?.(this, context, material, graph);
    }
  }

  applyTexture(context, texture, name) {
    this.uniforms.set(textureSamplerUniform(name), texture.getWebGLTexture(context));
    this.uniforms.set(textureUVSetUniform(name), texture.texCoord);
    texture.extensions?.KHR_texture_transform?.applyTextureTransform(this, textureUniformName(name));
    texture.extensions?.KHR_texture_basisu?.applyTextureTransform(this, textureUniformName(name));
  }
}

export default PBRProgram;
