import { mat4, vec3 } from '../../vendor/gl-matrix.js';

import { WebGLTF    } from '../webgltf.js';
import { Mesh       } from '../mesh.js';
import { Scene      } from '../scene.js';
import { Primitive  } from '../primitive.js';
import { Node       } from '../node.js';

/**
 * @external {HTMLCanvasElement} https://developer.mozilla.org/en/docs/Web/API/HTMLCanvasElement
 * @external {WebGLRenderingContext} https://developer.mozilla.org/en/docs/Web/API/WebGLRenderingContext
 */

// const GL = WebGLRenderingContext;

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
  constructor(target, { environment } = {}) {
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
      WEBGL_lose_context: this.context.getExtension('WEBGL_lose_context'),
    });

    this.context.enable(this.context.DEPTH_TEST);

    this.resizeCanvas();

    this.environment = environment;
    if (this.environment) {
      this.environment.createTextures(this.context);
    }
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
   * Initilize an object's WebGL data ahead of time.
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
      const { context } = this;

      primitive.createWebGLBuffers(context);
      primitive.createWebGLTextures(context);
      primitive.createWebGLProgram(context, this.environment, this.extensions);
    } else {
      throw new Error('Unknown object type');
    }
  }

  render(scene, camera) {
    const { context: gl } = this;

    this.resizeCanvas();

    // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const viewMatrix = camera.getTransform();
    const cameraPosition = vec3.create();

    mat4.getTranslation(cameraPosition, viewMatrix);
    mat4.invert(viewMatrix, viewMatrix);

    const projectionMatrix = camera.camera.getProjectionMatrix(gl.canvas.width, gl.canvas.height);

    const viewProjectionMatrix = mat4.create();
    mat4.multiply(viewProjectionMatrix, projectionMatrix, viewMatrix);

    for (const node of scene.nodes) {
      this.renderNode(node, cameraPosition, viewProjectionMatrix);
    }
  }

  renderNode(node, cameraPosition, viewProjectionMatrix, parentMatrix = mat4.create()) {
    const modelMatrix = node.getTransform();
    mat4.multiply(modelMatrix, parentMatrix, modelMatrix);

    const mvpMatrix = mat4.create();
    mat4.multiply(mvpMatrix, viewProjectionMatrix, modelMatrix);

    let joints;
    if (node.skin) {
      const inverse = mat4.create();
      mat4.invert(inverse, modelMatrix);

      joints = this.getJointTransforms(node.skin, [], node.skin.skeleton);

      for (let i = 0; i < node.skin.joints.length; i++) {
        const inverseBindMatrix = node.skin.inverseBindMatrices.createTypedView(i * 16, 1);

        mat4.mul(joints[i], inverse, joints[i]);
        mat4.mul(joints[i], joints[i], inverseBindMatrix);
      }

      joints = [].concat(...joints.map(j => Object.values(j)));
    }

    if (node.mesh) {
      for (const primitive of node.mesh.primitives) {
        const program = primitive.getProgram(this.context, this.environment, this.extensions);
        const { weights = node.mesh.weights } = node;

        program.run(primitive, cameraPosition, modelMatrix, mvpMatrix, weights, joints, this.environment);
      }
    }

    for (const n of node.children) {
      this.renderNode(n, cameraPosition, viewProjectionMatrix, modelMatrix);
    }
  }

  getJointTransforms(skin, joints, joint, parentMatrix = mat4.create()) {
    const jointMatrix = joint.getTransform();
    mat4.multiply(jointMatrix, parentMatrix, jointMatrix);

    joints[skin.joints.indexOf(joint)] = jointMatrix;

    for (const j of joint.children) {
      this.getJointTransforms(skin, joints, j, jointMatrix);
    }

    return joints;
  }
}

export default Renderer;
