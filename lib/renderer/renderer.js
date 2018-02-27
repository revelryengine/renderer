import { mat4 } from '../../vendor/gl-matrix.js';
import { createTexture, createBuffer } from './utils.js';

import { PBRProgram } from './pbr-program.js';
import { WebGLTF    } from '../webgltf.js';
import { Mesh       } from '../mesh.js';
import { Scene      } from '../scene.js';
import { Primitive  } from '../primitive.js';
import { Node       } from '../node.js';

/**
 * @external {HTMLCanvasElement} https://developer.mozilla.org/en/docs/Web/API/HTMLCanvasElement
 */

/**
 * @external {WebGLRenderingContext} https://developer.mozilla.org/en/docs/Web/API/WebGLRenderingContext
 */

/**
 * A glTF scene renderer.
 */
export class Renderer {
  /**
   * Creates an instance of Renderer.
   *
   * @param {string|HTMLCanvasElement|WebGLRenderingContext} target - Can either be an HTMLCanvasElement, a selector, or
   * an existing WebGLRenderingContext
   */
  constructor(target) {
    let canvas;
    if (target instanceof WebGLRenderingContext) {
      return target;
    } else if (target instanceof HTMLCanvasElement) {
      canvas = target;
    } else if (typeof target === 'string') {
      canvas = document.querySelector(target);
    } else {
      throw new Error('Failed to get WebGL context from target. Invalid target type.');
    }

    this.context = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!this.context) {
      throw new Error('Failed to get WebGL context from element. Make sure WebGL is supported.');
    }

    this.extensions = Object.freeze({
      EXT_shader_texture_lod: this.context.getExtension('EXT_shader_texture_lod'),
      OES_standard_derivatives: this.context.getExtension('OES_standard_derivatives'),
      EXT_SRGB: this.context.getExtension('EXT_SRGB'),
    });

    this.matrix = mat4.create();
    this.updateProjectionMatrix();

    this.contextMap = new WeakMap();
    this.programMap = new WeakMap();

    this.textures = new WeakMap();
    this.buffers = new WeakMap();
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
   *
   * @param {WebGLTF|Scene|Node|Mesh|Primitive} object - The object to initialize within the Renderer.
   * Recursively calls init on children objects.
   */
  init(object) {
    if (object instanceof WebGLTF || object instanceof Scene) {
      for (const node of object.nodes) {
        this.init(node);
      }
    } else if (object instanceof Node) {
      if (object.mesh) {
        this.init(object.mesh);
      }
    } else if (object instanceof Mesh) {
      for (const primitive of object.primitives) {
        this.init(primitive);
      }
    } else if (object instanceof Primitive) {
      const primitive = object;
      if (!this.contextMap.get(primitive)) {
        const { context, extensions, contextMap } = this;

        // initialize accessors
        const { POSITION, NORMAL, TANGENT, TEXCOORD_0 } = primitive.attributes;

        for (const accessor of [primitive.indices, POSITION, NORMAL, TANGENT, TEXCOORD_0]) {
          if (accessor && !contextMap.get(accessor)) {
            const { buffer: { $data: data }, byteLength, target } = accessor.bufferView;
            const { componentType } = accessor;
            const byteOffset = accessor.byteOffset + accessor.bufferView.byteOffset;
            const buffer = createBuffer(this.context, { data, target, componentType, byteOffset, byteLength });
            contextMap.set(accessor, buffer);
          }
        }

        // initialize textures
        const {
          pbrMetallicRoughness: { baseColorTexture, metallicRoughnessTexture },
          normalTexture, occlusionTexture, emissiveTexture,
        } = primitive.material;

        const SRGB = new Set([baseColorTexture, emissiveTexture]);
        const RGBA = new Set([metallicRoughnessTexture, normalTexture, occlusionTexture]);

        for (const textureInfo of [...SRGB, ...RGBA]) {
          if (textureInfo && !contextMap.get(textureInfo)) {
            const { texture: { source: { $data: image }, sampler } } = textureInfo;
            const colorSpace = SRGB.has(textureInfo) && extensions.EXT_SRGB ? extensions.EXT_SRGB.SRGB_EXT : undefined;
            const texture = createTexture(this.context, { image, ...sampler, colorSpace });
            contextMap.set(textureInfo, texture);
          }
        }

        contextMap.set(primitive, new PBRProgram({ context, extensions, primitive, contextMap }));
      }
    } else {
      throw new Error('Unknown object type');
    }
  }

  render(scene, camera) {
    this.updateProjectionMatrix();

    const cameraMatrix = mat4.clone(camera.matrix);
    if (camera.camera.type === 'perspective') {
      const { yfov, aspectRatio, zfar, znear } = camera.camera.perspective;
      mat4.perspective(cameraMatrix, yfov, aspectRatio, znear, zfar);
    } else {
      const { xmag, ymag, zfar, znear } = camera.camera.orthographic;
      mat4.ortho(cameraMatrix, 0, xmag, 0, ymag, znear, zfar);
    }

    const viewMatrix = mat4.create();
    mat4.invert(viewMatrix, cameraMatrix);

    for (const node of scene.nodes) {
      this.renderNode(node, viewMatrix);
    }
  }

  renderNode(node, viewMatrix, parentTransform = mat4.create()) {
    const localTransform = mat4.create();
    mat4.multiply(localTransform, node.matrix, parentTransform);

    if (node.mesh) {
      for (const primitive of node.mesh.primitives) {
        if (!this.contextMap.get(primitive)) {
          this.init(primitive);
        }

        this.contextMap.get(primitive).run(primitive, localTransform, viewMatrix, this.matrix, this.contextMap);
      }
    }

    for (const n of node.children) {
      this.renderNode(n, viewMatrix, localTransform);
    }
  }
}

export default Renderer;
