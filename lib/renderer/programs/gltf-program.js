import { Program  } from './program.js';
import { mat4     } from '../../utils/gl-matrix.js';

import { vertexShader   } from '../shaders/primitive.vert.js';
import { fragmentShader } from '../shaders/pbr.frag.js';
import { LIGHT_TYPES } from '../../extensions/KHR_lights_punctual.js';

const INSTANCE_COUNT_MAX = 1000;

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
    'DEBUG_SHADOW_CASCADE',
  ].map((name, i) => [name, i])),
  DEBUG: 'DEBUG_NONE',
}

export const TONEMAP_DEFINES = {
  'Aces Hill Exposure Boost': 'TONEMAP_ACES_HILL_EXPOSURE_BOOST',
  'Aces Narkowicz': 'TONEMAP_ACES_NARKOWICZ',
  'Aces Hill': 'TONEMAP_ACES_HILL'
}

/**
 * A standard physically based rendering program.
 */
export class GLTFProgram extends Program {
  static vertexShaderSrc   = vertexShader;
  static fragmentShaderSrc = fragmentShader;

  queue = [];

  /**
   * Creates an instance of GLTFProgram from a {@link Primitive}.
   * @param {WebGLRenderingContext} context - The WebGL Rendering Context.
   * @param {Object} params - The GLTFProgram parameters
   */
  constructor(context, { primitive, node, graph, settings, defines = {} } = {}) {
    const { attributes, targets = [] } = primitive;

    const { ibl, punctual, ssao, shadows, fog, tonemap, debug } = settings;

    const lightCount  = graph.lights.length;
    const jointCount  = node.skin?.joints?.length;
    const weightCount = node.mesh?.weights?.length;

    const material = primitive.getMaterial(context);

    const shadowMultiplier = { [LIGHT_TYPES.spot]: 1, [LIGHT_TYPES.directional]: shadows.cascades, [LIGHT_TYPES.point]: 0 };
    const shadowCount = graph.lights.reduce((sum, light) => {
      return sum + shadowMultiplier[light.type];
    }, 0);
    
    defines = {
      USE_IBL:      graph.environment && ibl.enabled ? 1 : null,
      USE_PUNCTUAL: graph.lights.length && punctual.enabled ? 1 : null,
      USE_SHADOWS:  punctual.enabled && shadows.enabled && shadowCount ? 1 : null,
      USE_SSAO:     ssao.enabled ? 1 : null,
      USE_FOG:      fog.enabled ? 1 : null,
      
      USE_MORPHING: weightCount > 0 ? 1 : null,
      WEIGHT_COUNT: weightCount > 0 ? weightCount : null,

      USE_SKINNING: jointCount  > 0 ? 1 : null,
      JOINT_COUNT:  jointCount  > 0 ? jointCount  : null,

      LIGHT_COUNT:  lightCount  > 0 ? lightCount  : null,
      SHADOW_COUNT: shadowCount > 0 ? shadowCount : null,
      SHADOW_CASCADES: shadows.cascades > 0 ? shadows.cascades : null,

      ...DEBUG_DEFINES,

      DEBUG: debug || 'DEBUG_NONE',

      ...defines,
    };

    if(TONEMAP_DEFINES[tonemap]) defines[TONEMAP_DEFINES[tonemap]] = 1;

    GLTFProgram.defineMaterial(defines, material);

    const maxAttributes = context.getParameter(context.MAX_VERTEX_ATTRIBS) - 5; // 5 are needed for instancing
    let attributeCount = 0;
    for(const name of Object.keys(attributes)) {
      if(attributeCount++ < maxAttributes) defines[hasAttributeDefine(name, attributes[name])] = 1;
    }

    for(let i = 0; i < targets.length; i++) {
      for(const name of ['POSITION', 'NORMAl', 'TANGENT']) {
        if(targets[i][name] && attributeCount++ < maxAttributes) defines[hasTargetDefine(name, i, targets[i][name])] = 1;
      }
    }

    super(context, { defines, settings });
  }

  define(defines) {
    return super.define(defines);
  }

  update({ primitive, graph, node, frustum, input }) {
    this.updateVertex({ primitive, graph, node, frustum, input });
    this.updateFragment({ primitive, graph, node, frustum, input });
    super.update();
  }

  updateVertex({ primitive, node, graph, frustum }) {
    const { viewMatrix, projectionMatrix, viewProjectionMatrix } = frustum;

    this.uniforms.set('u_ViewMatrix', viewMatrix);
    this.uniforms.set('u_ProjectionMatrix', projectionMatrix);
    this.uniforms.set('u_ViewProjectionMatrix', viewProjectionMatrix);

    if(node.skin) {
      const { jointMatrices, jointNormalMatrices } = graph.getJointMatrices(node, node.skin);
      this.uniforms.set('u_jointMatrix', jointMatrices);
      this.uniforms.set('u_jointNormalMatrix', jointNormalMatrices);
    }

    if(node.mesh.weights) {
      const { weights: morphWeights = node.mesh.weights } = node;
      this.uniforms.set('u_morphWeights', morphWeights);
    }

    const { attributes, targets = [] } = primitive;

    for(const name in attributes) {
      const attr = attributes[name];
      this.setAccessorAttribute(primitiveAttribute(name), attr);
    }

    for(let i = 0; i < targets.length; i++) {
      for(const name of ['POSITION', 'NORMAL', 'TANGENT']) {
        if(targets[i][name]) this.setAccessorAttribute(targetAttribute(name, i), targets[i][name]);
      }
    }
  }

  setAccessorAttribute(name, accessor) {
    const { context: gl } = this;

    const {
      bufferView: { byteStride:stride = accessor.getElementSize(), target = gl.ARRAY_BUFFER } = {},
      componentType:type = gl.FLOAT, normalized = false,
    } = accessor;

    const size   = accessor.getNumberOfComponents();
    const buffer = accessor.getWebGLBuffer(gl);
    
    this.attributes.set(name, { target, buffer, size, type, normalized, stride, offset: 0 });
  }

  updateFragment({ primitive, graph, frustum, input }) {
    const { lights, environment } = graph;

    const { context } = this;

    this.uniforms.set('u_Camera', frustum.position);
    this.uniforms.set('u_Exposure', 1);
    this.uniforms.set('u_Lights', lights);
    
    const material = primitive.getMaterial(context);

    this.applyMaterial(context, material, input);  
    
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
    
    if(this.defines.USE_FOG) {
      const { color, range } = this.settings.fog;
      this.uniforms.set('u_FogColor', color);
      this.uniforms.set('u_FogRange', range);
    }

    if(input.shadows) {
      this.uniforms.set('u_ShadowSamplers', input.shadows.glTexture);
      this.uniforms.set('u_ShadowMatrices', input.shadows.matrices);
      this.uniforms.set('u_ShadowSplits',   input.shadows.splits);
    }

    if(input.ssao){
      this.uniforms.set('u_SSAOSampler', input.ssao.glTexture);
      this.uniforms.set('u_ViewportDimensions', [frustum.viewport.width, frustum.viewport.height]);
    }
  }

  // draw(primitive) {
  //   const { context: gl } = this;
  //   const { indices, attributes, mode } = primitive;

  //   if (indices) {
  //     const { count, componentType } = indices;
  //     gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices.getWebGLBuffer(gl, gl.ELEMENT_ARRAY_BUFFER));
  //     gl.drawElements(mode, count, componentType, 0);
  //   } else {
  //     /**
  //      * If indices is not defined use drawArrays instead with a count from any of the attributes. They should all be the same.
  //      * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#meshes
  //      */
  //     const { count } = Object.values(attributes)[0];
  //     gl.drawArrays(mode, 0, count);
  //   }

  //   super.draw();
  // }

  run() {
    super.run();

    const { primitive, graph } = this.queue[0];

    while(this.queue.length) {
      const instanceCount = Math.min(this.queue.length, INSTANCE_COUNT_MAX);
      this.setInstanceData(graph, instanceCount);
      this.drawInstances(primitive, instanceCount);
    }
  }

  drawInstances(primitive, instanceCount) {
    const { context: gl } = this;
    
    const { indices, attributes, mode } = primitive;

    if (indices) {
      const { count, componentType } = indices;
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices.getWebGLBuffer(gl, gl.ELEMENT_ARRAY_BUFFER));
      gl.drawElementsInstanced(mode, count, componentType, 0, instanceCount);
    } else {
      /**
       * If indices is not defined use drawArrays instead with a count from any of the attributes. They should all be the same.
       * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#meshes
       */
      const { count } = Object.values(attributes)[0];
      
      gl.drawArraysInstanced(mode, 0, count, instanceCount);
    }
  }

  runSingle({ graph, primitive, node, frustum, input }) {
    this.use();
    this.update({ graph, primitive, node, frustum, input });
    this.queue.push({ graph, primitive, node, frustum, input });
    this.run();
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
        GLTFProgram.defineTexture(defines, texture, name);
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

  applyMaterial(context, material, input) {
    const {
      pbrMetallicRoughness = {},
      normalTexture, occlusionTexture, emissiveTexture, emissiveFactor, doubleSided, alphaMode, alphaCutoff
    } = material || {};

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
    for(const name in material?.extensions) {
      material.extensions[name]?.applyMaterial?.(this, context, input);
    }
  }

  applyTexture(context, texture, name) {
    this.uniforms.set(textureSamplerUniform(name), texture.getWebGLTexture(context));
    this.uniforms.set(textureUVSetUniform(name), texture.texCoord);
    texture.extensions?.KHR_texture_transform?.applyTextureTransform(this, textureUniformName(name));
    texture.extensions?.KHR_texture_basisu?.applyTextureTransform(this, textureUniformName(name));
  }

  static #instanceBuffers = new WeakMap();
  static getInstanceBuffers(context) {
    return this.#instanceBuffers.get(context) || this.#instanceBuffers.set(context, this.createInstanceBuffers(context)).get(context);
  }

  static createInstanceBuffers(context) {
    const primitiveIds  = new Uint32Array(INSTANCE_COUNT_MAX * 2);

    const modelMatrices = new Float32Array(INSTANCE_COUNT_MAX * 16);

    const modelMatrixViews  = [];
    for(let i = 0; i < INSTANCE_COUNT_MAX; i++) {
      const offset = i * 16 * 4;
      modelMatrixViews.push(new Float32Array(modelMatrices.buffer, offset, 16));
    }

    const gl = context;

    const primitiveIdBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, primitiveIdBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, primitiveIds.byteLength, gl.DYNAMIC_DRAW);

    const modelMatrixBuffer  = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, modelMatrixBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, modelMatrices.byteLength, gl.DYNAMIC_DRAW);

    return {
      primitiveIds,  primitiveIdBuffer,
      modelMatrices, modelMatrixViews, modelMatrixBuffer,
    }
  }

  setInstanceData(graph, instanceCount) {
    const { context: gl } = this;

    const { 
      modelMatrices, modelMatrixViews, modelMatrixBuffer, 
      primitiveIds, primitiveIdBuffer,
    } = GLTFProgram.getInstanceBuffers(gl);

    for(let i = 0; i < instanceCount; i++) {
      const { node, primitive } = this.queue.pop();

      primitiveIds[(i * 2) + 0] = primitive.$id;
      primitiveIds[(i * 2) + 1] = node.$id;

      mat4.copy(modelMatrixViews[i],  graph.getWorldTransform(node));
    }

    this.attributes.set('a_primitiveId', { 
      target: gl.ARRAY_BUFFER, size: 2, type: gl.UNSIGNED_INT, normalized: false, stride: 4 * 2, divisor: 1, integer: true,
      buffer: primitiveIdBuffer,  subData: { arrayBuffer: primitiveIds  },
    });

    this.attributes.set('a_modelMatrix',  { 
      target: gl.ARRAY_BUFFER, size: 4, type: gl.FLOAT, normalized: false, stride: 4 * 16, divisor: 1, 
      buffer: modelMatrixBuffer,  subData: { arrayBuffer: modelMatrices  },
    });
    
    this.attributes.update();
  }
}

export default GLTFProgram;
