import { mat4, vec3 } from '../../vendor/gl-matrix.js';

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

const GL = WebGLRenderingContext;

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
      OES_element_index_uint: this.context.getExtension('OES_element_index_uint'),
    });

    this.context.enable(this.context.DEPTH_TEST);

    this.resizeCanvas();

    this.contextMap = new WeakMap();
  }

  /**
   * The dimensions of the target are determined by the offset width and height, so CSS should be used to adjust the
   * dimensions.
   */
  resizeCanvas() {
    const { canvas } = this.context;

    const width = canvas.offsetWidth || canvas.width;
    const height = canvas.offsetHeight || canvas.height;

    if (width !== canvas.width || height !== canvas.height) {
      canvas.width = width;
      canvas.height = height;
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
        const { context, contextMap } = this;

        // initialize buffers
        const { targets = [] } = primitive;
        const accessors = [primitive.indices, ...Object.values(primitive.attributes)]
          .concat(...targets.map(v => Object.values(v)));
        for (const accessor of accessors) {
          if (accessor && !contextMap.get(accessor.bufferView)) {
            const inferredTarget = accessor === primitive.indices ? GL.ELEMENT_ARRAY_BUFFER : GL.ARRAY_BUFFER;
            contextMap.set(accessor.bufferView, accessor.bufferView.createBuffer(this.context, inferredTarget));
          }
        }

        if (primitive.material) {
          // initialize textures
          const {
            pbrMetallicRoughness: { baseColorTexture, metallicRoughnessTexture },
            normalTexture, occlusionTexture, emissiveTexture,
          } = primitive.material;

          const textureInfos = [
            baseColorTexture, emissiveTexture, metallicRoughnessTexture, normalTexture, occlusionTexture,
          ];
          for (const textureInfo of textureInfos) {
            if (textureInfo && !contextMap.get(textureInfo)) {
              contextMap.set(textureInfo, textureInfo.texture.createTexture(this.context));
            }
          }
        }
        contextMap.set(primitive, new PBRProgram({ context, primitive, contextMap }));
      }
    } else {
      throw new Error('Unknown object type');
    }
  }

  render(scene, camera) {
    const { context: gl } = this;

    this.resizeCanvas();

    // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const projectionMatrix = mat4.create();
    if (camera.camera.type === 'perspective') {
      const { yfov, aspectRatio, zfar, znear } = camera.camera.perspective;
      mat4.perspective(
        projectionMatrix, yfov,
        aspectRatio || (gl.canvas.width / gl.canvas.height), znear, zfar || 100.0,
      );
    } else {
      const { xmag, ymag, zfar, znear } = camera.camera.orthographic;
      mat4.ortho(projectionMatrix, 0, xmag, 0, ymag, znear, zfar);
    }

    const viewMatrix = mat4.create();
    mat4.invert(viewMatrix, camera.getTransform());

    const viewProjectionMatrix = mat4.create();
    mat4.multiply(viewProjectionMatrix, projectionMatrix, viewMatrix);

    const cameraTranslate = vec3.create();
    mat4.getTranslation(cameraTranslate, camera.matrix);

    for (const node of scene.nodes) {
      this.renderNode(node, cameraTranslate, viewProjectionMatrix);
    }
  }

  renderNode(node, cameraTranslate, viewProjectionMatrix, parentMatrix = mat4.create()) {
    const modelMatrix = node.getTransform();
    mat4.multiply(modelMatrix, parentMatrix, modelMatrix);

    const mvpMatrix = mat4.create();
    mat4.multiply(mvpMatrix, viewProjectionMatrix, modelMatrix);

    if (node.mesh) {
      for (const primitive of node.mesh.primitives) {
        if (!this.contextMap.get(primitive)) {
          this.init(primitive);
        }
        const program = this.contextMap.get(primitive);
        const { weights = node.weights } = node.mesh;
        program.run(primitive, cameraTranslate, modelMatrix, mvpMatrix, this.contextMap, weights);
      }
    }

    for (const n of node.children) {
      this.renderNode(n, cameraTranslate, viewProjectionMatrix, modelMatrix);
    }
  }
}

export default Renderer;
