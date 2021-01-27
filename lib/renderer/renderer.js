import { glMatrix } from '../webgltf.js';

import { KHRLightsPunctualLight } from '../extensions/KHR_lights_punctual.js';

import { PBRProgram } from './pbr-program.js';
import { Graph } from './graph.js';

const { mat4, vec3 } = glMatrix;

/**
 * @external HTMLCanvasElement
 * @see https://developer.mozilla.org/en/docs/Web/API/HTMLCanvasElement
 */

/**
 * @external WebGLRenderingContext
 * @see https://developer.mozilla.org/en/docs/Web/API/WebGLRenderingContext
 */

const GL_EXTENSIONS = [
  "EXT_texture_filter_anisotropic",
  "OES_texture_float_linear",
  "WEBGL_lose_context",
  "KHR_parallel_shader_compile",
];

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
  constructor(target, { autoresize = true, ibl } = {}) {
    let canvas;
    if (target instanceof WebGL2RenderingContext) {
      this.context = target;
    } else if (target instanceof HTMLCanvasElement) {
      canvas = target;
      this.context = canvas.getContext('webgl2', { xrCompatible: true });
    } else if (typeof target === 'string') {
      canvas = document.querySelector(target);
      this.context = canvas.getContext('webgl2', { xrCompatible: true });
    } else {
      throw new Error('Failed to get WebGL context from target. Invalid target type.');
    }

    if (!this.context) {
      throw new Error('Failed to get WebGL 2.0 context from element. Make sure WebGL 2.0 is supported.');
    }

    const glExtensions = {};
    for(const ext of GL_EXTENSIONS) {
      glExtensions[ext] = this.context.getExtension(ext);
    }
    this.glExtensions = Object.freeze(glExtensions);

    this.context.enable(this.context.DEPTH_TEST);
    this.context.depthFunc(this.context.LEQUAL);
    this.context.colorMask(true, true, true, true);
    this.context.clearDepth(1.0);

    this.autoresize = autoresize;
    if(this.autoresize) this.resizeCanvas();

    this.ibl = ibl;
    if (this.ibl) {
      this.ibl.createTextures(this.context);
    }

    this.graph = new Graph();
    this.programs = new WeakMap();

    this.lights = [];
    this.defaultLights = [
      new KHRLightsPunctualLight({ type: 'directional', intensity: 0.1 }).getUniformStruct(),
      new KHRLightsPunctualLight({ type: 'directional', intensity: 0.1 }).getUniformStruct(
        mat4.fromRotation(mat4.create(), 3 * Math.PI / 4, [0, 1, -1])
      ),
      new KHRLightsPunctualLight({ type: 'directional', intensity: 0.5 }).getUniformStruct(
        mat4.fromRotation(mat4.create(), 3 * Math.PI / 4, [-0.5, -1, 0])
      ),
    ];
  }

  /**
   * The dimensions of the target are determined by the offset width and height, so CSS should be used to adjust the
   * dimensions.
   */
  resizeCanvas() {
    const { scaleFactor = 1} = this;
    const { canvas } = this.context;

    const width = (canvas.offsetWidth || canvas.width) * scaleFactor;
    const height = (canvas.offsetHeight || canvas.height) * scaleFactor;

    if (Math.abs(width - canvas.width) > 1 || Math.abs(height - canvas.height) > 1) {
      canvas.width = width;
      canvas.height = height;
      this.context.viewport(0, 0, width, height);
    }
  }

  /**
   * Preload a WebGLTF object into WebGL. Asynchronously compiles shaders and creates webgl textures and buffers.
   *
   * @param {WebGLTF} webgltf - The WebGLTF object to preload within the Renderer.
   */
  async preload(webgltf, abortCtl) {
    const nodes = new Set();
    const search = [...webgltf.nodes];
    while(search.length) {
      const node = search.pop();
      if(node.children) search.push(...node.children);
      nodes.add(node);
    }

    for(const node of nodes) {
      if(node.mesh) {
        const jointMatrices = this.graph.getJointMatrices(node);

        await Promise.all(node.mesh.primitives.map(primitive => {
          const program = this.getProgram(primitive, jointMatrices && jointMatrices.length / 16);
          if(primitive.indices) primitive.indices.createWebGLBuffer(this.context, this.context.ELEMENT_ARRAY_BUFFER);
          return program.compile({ sync: false }, abortCtl);
        }));
      }
    }

    for(const texture of webgltf.textures) {
      texture.createWebGLTexture(this.context);
      await 0; // unblock the ui thread
    }

    for(const accessor of webgltf.accessors) {
      accessor.createWebGLBuffer(this.context);
      await 0; // unblock the ui thread
    }
    return;
  }

  render(scene, cameraNode) {
    const { context: gl } = this;

    if(this.autoresize) this.resizeCanvas();

    this.graph.update(cameraNode); // come back to this
    this.graph.analyze(scene);


    this.lights = [...this.graph.lights.map(({ struct }) => struct)];

    if(!this.lights.length) {
      this.lights.push(...this.defaultLights);
    }

    // this.ibl = this.graph.ibl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const viewMatrix = mat4.create();
    const cameraPosition = vec3.create();
    const cameraTransform = this.graph.getWorldTransform(cameraNode);

    mat4.getTranslation(cameraPosition, cameraTransform);
    mat4.invert(viewMatrix, cameraTransform);

    const projectionMatrix = cameraNode.camera.getProjectionMatrix(gl.canvas.width, gl.canvas.height);

    const viewProjectionMatrix = mat4.create();
    mat4.multiply(viewProjectionMatrix, projectionMatrix, viewMatrix);

    const sorted = this.graph.getSortedPrimitives(viewMatrix);
    for(const { primitive, node } of sorted) {
      this.renderNodePrimitive(node, primitive, cameraPosition, viewProjectionMatrix);
    }
  }

  renderNodePrimitive(node, primitive, cameraPosition, viewProjectionMatrix) {
    // if(!primitive.enabled) return;

    const modelMatrix         = this.graph.getWorldTransform(node);
    const normalMatrix        = this.graph.getNormalMatrix(node);
    const jointMatrices       = this.graph.getJointMatrices(node);
    const jointNormalMatrices = this.graph.getJointNormalMatrices(node);

    const { weights: morphWeights = node.mesh.weights } = node;

    const program = this.getProgram(primitive, jointMatrices && jointMatrices.length / 16);

    program.run(
      primitive,
      cameraPosition, modelMatrix, viewProjectionMatrix, normalMatrix,
      jointMatrices, jointNormalMatrices, morphWeights, this.lights, this.ibl
    );
  }

  createProgram(primitive, jointCount) {
    let program = this.programs.get(primitive);
    if (program) return program;

    const { context, lights, ibl, glExtensions } = this;

    program = new PBRProgram(context, { primitive, lights, ibl, glExtensions, jointCount });

    this.programs.set(primitive, program);
    return program;
  }

  getProgram(primitive, jointCount) {
    return this.programs.get(primitive) || this.programs.set(primitive, this.createProgram(primitive, jointCount)).get(primitive);
  }

  renderXR(scene, xrRefSpace, xrFrame) {
    const { context: gl } = this;

    const pose = xrFrame.getViewerPose(xrRefSpace);

    if(pose) {
      let glLayer = xrFrame.session.renderState.baseLayer;

      this.graph.analyze(scene);
      this.lights = [...this.graph.lights.map(({ struct }) => struct)];

      if(!this.lights.length) {
        this.lights.push(...this.defaultLights);
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, glLayer.framebuffer);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      for (const view of pose.views) {
        const viewport = glLayer.getViewport(view);
        gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);

        const viewMatrix = view.transform.inverse.matrix;
        const cameraPosition = vec3.create();
        const cameraTransform = pose.transform.matrix;

        mat4.getTranslation(cameraPosition, cameraTransform);
        mat4.invert(viewMatrix, cameraTransform);

        const projectionMatrix = view.projectionMatrix;

        const viewProjectionMatrix = mat4.create();
        mat4.multiply(viewProjectionMatrix, projectionMatrix, viewMatrix);

        const sorted = this.graph.getSortedPrimitives(viewMatrix);
        for(const { primitive, node } of sorted) {
          this.renderNodePrimitive(node, primitive, cameraPosition, viewProjectionMatrix);
        }
      }
    }
  }
}

export default Renderer;
