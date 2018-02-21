import { mat4 } from '../node_modules/gl-matrix/src/gl-matrix.js';

import { vertex, fragment } from './shaders/pbr.js';
import { Program } from './program.js';

/**
 * @param {string|HTMLCanvasElement|WebGLRenderingContext} target - Can either be an HTMLCanvasElement, a selector, or
 * an existing WebGLRenderingContext
 */
export class Renderer {
  constructor(target) {
    let canvas;
    if (target instanceof WebGLRenderingContext) {
      return target;
    } else if (target instanceof HTMLCanvasElement) {
      canvas = target;
    } else if (typeof target === 'string') {
      canvas = document.querySelector(target);
    } else {
      throw new Error('Failed to get WebFL context from target. Invalid target type.');
    }

    this.context = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!this.context) {
      throw new Error('Failed to get WebGL context from element. Make sure WebGL is supported.');
    }

    this.extensions = {
      EXT_shader_texture_lod: this.context.getExtension('EXT_shader_texture_lod'),
      OES_standard_derivatives: this.context.getExtension('OES_standard_derivatives'),
      EXT_SRGB: this.context.getExtension('EXT_SRGB'),
    };

    this.matrix = mat4.create();
    this.updateProjectionMatrix();
  }

  /**
   * Updates the projection matrix. The dimensions of the target are determined by the offset width and height, so CSS
   * should be used to adjust the dimensions.
   */
  updateProjectionMatrix() {
    const { canvas } = this.context;

    const width = canvas.offsetWidth || canvas.width;
    const height = canvas.offsetHeight || canvas.height;

    if (width !== canvas.width || height !== canvas.height) {
      canvas.width = width;
      canvas.height = height;
      mat4.perspective(this.matrix, (45.0 * Math.PI) / 180.0, width / height, 0.01, 100.0);
      this.context.viewport(0, 0, width, height);
    }
  }

  /**
   * Creates a WebGL program based on primitive attributes and material.
   * @param {Primitive} primitive - The primitive to create a program for.
   */
  createProgram(primitive) {
    const defines = {};
    const uniforms = {};
    const samplers = {};

    if (primitive.attributes.NORMAL !== undefined) defines.HAS_NORMALS = 1;
    if (primitive.attributes.TANGENT !== undefined) defines.HAS_TANGENTS = 1;
    if (primitive.attributes.TEXCOORD_0 !== undefined) defines.HAS_UV = 1;

    const {
      pbrMetallicRoughness = {},
      normalTexture, occlusionTexture, emissiveTexture, emissiveFactor,
    } = primitive.material;

    const {
      baseColorFactor, metallicFactor, roughnessFactor,
      baseColorTexture, metallicRoughnessTexture,
    } = pbrMetallicRoughness;

    uniforms['u_BaseColorFactor'] = baseColorFactor;
    uniforms['u_MetallicRoughnessValues'] = [metallicFactor, roughnessFactor];


    if (baseColorTexture) {
      defines.HAS_BASECOLORMAP = 1;
      samplers['u_BaseColorSampler'] = { info: baseColorTexture, colorSpace: this.extensions.EXT_SRGB ? this.extensions.EXT_SRGB.SRGB_EXT : undefined };
    }

    if (metallicRoughnessTexture) {
      defines.HAS_METALROUGHNESSMAP = 1;
      samplers['u_MetallicRoughnessSampler'] = { info: metallicRoughnessTexture };
    }

    if (normalTexture) {
      defines.HAS_NORMALMAP = 1;
      samplers['u_NormalSampler'] = { info: normalTexture };
      uniforms['u_NormalScale'] = [normalTexture.scale];
    }

    if (occlusionTexture) {
      defines.HAS_OCCLUSIONMAP = 1;
      samplers['u_OcclusionSampler'] = { info: occlusionTexture };
    }

    if (emissiveTexture) {
      defines.HAS_EMISSIVEMAP = 1;
      samplers['u_EmissiveSampler'] = { info: emissiveTexture, colorSpace: this.extensions.EXT_SRGB ? this.extensions.EXT_SRGB.SRGB_EXT : undefined };
      uniforms['u_EmissiveFactor'] = emissiveFactor;
    }

    const define = Object.entries(defines).map(([key, val]) => `#define ${key} ${val}`).join('\n');
    const program = new Program(this.context, `${define}\n${vertex}`, `${define}\n${fragment}`, uniforms);
    program.use();

    for (const [name, value] of Object.entries(uniforms)) {
      program.uniforms[name].set(value);
    }

    for (const [name, { info, colorSpace }] of Object.entries(samplers)) {
      const index = program.uniforms[name].samplers[0];
      const image = info.texture.source.$data;
      program.createTexture({ ...info.texture.sampler, colorSpace, index, image });
    }

    // if(primitive.attributes.NORMAL) {
    //   // { buffer, size, type = context.FLOAT, normalize = false, stride = 0, offset = 0 }
    //   program.createBuffer()
    // }

    return program;
  }

  /**
   *
   * @param {WebGLTF|Scene|Node|Mesh} object - The object to initialize within the Renderer.
   */
  init(object) {
    return object.init(this);
  }
}

export default Renderer;
