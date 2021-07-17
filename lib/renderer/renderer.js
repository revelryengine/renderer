import { mat4, vec3 } from '../utils/gl-matrix.js';

import { Graph } from './graph.js';

import { KHRLightsPunctualLight } from '../extensions/KHR_lights_punctual.js';

import { PrePass    } from './passes/pre-pass.js';
import { SSAOPass   } from './passes/ssao-pass.js';
import { MainPass   } from './passes/main-pass.js';

/**
 * @external HTMLCanvasElement
 * @see https://developer.mozilla.org/en/docs/Web/API/HTMLCanvasElement
 */

/**
 * @external WebGLRenderingContext
 * @see https://developer.mozilla.org/en/docs/Web/API/WebGLRenderingContext
 */

const GL_EXTENSIONS = [
  'EXT_texture_filter_anisotropic',
  'KHR_parallel_shader_compile',
  'OES_texture_float_linear',
  'WEBGL_lose_context',
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
  constructor(target, { autoresize = true, environment, xrCompatible = false } = {}) {
    let canvas;
    if (target instanceof WebGL2RenderingContext) {
      this.context = target;
    } else if (target instanceof HTMLCanvasElement) {
      canvas = target;
      this.context = canvas.getContext('webgl2', { xrCompatible });
    } else if (typeof target === 'string') {
      canvas = document.querySelector(target);
      this.context = canvas.getContext('webgl2', { xrCompatible });
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
    this.context.glExtensions = this.glExtensions;

    this.context.enable(this.context.DEPTH_TEST);
    this.context.depthFunc(this.context.LEQUAL);
    this.context.colorMask(true, true, true, true);
    this.context.clearDepth(1.0);

    this.autoresize = autoresize;

    this.environment = environment;

    this.useIBL = true;
    this.usePunctual = true;
    this.useSSAO = true;
    
    this.graph = new Graph();
    // this.programs = new WeakMap();

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

    this.debug = 'DEBUG_NONE';

    this.passes = [
      new PrePass(this.context),
      new SSAOPass(this.context),
      new MainPass(this.context),
    ];
  }

  /**
   * The dimensions of the target are determined by the offset width and height, so CSS should be used to adjust the
   * dimensions.
   */
  resize() {
    const { scaleFactor = 1 } = this;
    const { canvas } = this.context;

    const width = (canvas.offsetWidth || canvas.width) * scaleFactor;
    const height = (canvas.offsetHeight || canvas.height) * scaleFactor;

    if (Math.abs(width - canvas.width) > 1 || Math.abs(height - canvas.height) > 1) {
      canvas.width = width;
      canvas.height = height;

      for(const pass of this.passes) {
        pass.resize({ width, height });
      }
    }
  }

  /**
   * Preload a WebGLTF object into WebGL. Asynchronously creates webgl textures and buffers.
   *
   * @param {WebGLTF} webgltf - The WebGLTF object to preload within the Renderer.
   */
  async preload(webgltf, abortCtl) {
    const { signal } = abortCtl;
    for(const node of (webgltf.scene || webgltf.scenes[0]).depthFirstSearch()) {
      if(node.mesh) {
        for(const primitive of node.mesh.primitives) {
          if(primitive.indices) primitive.indices.createWebGLBuffer(this.context, this.context.ELEMENT_ARRAY_BUFFER);
          await Promise.resolve(); // unblock the ui thread
          if (signal.aborted) throw new DOMException('aborted!', 'AbortError');
        }
      }
    }

    for(const texture of webgltf.textures) {
      texture.getWebGLTexture(this.context);
      await Promise.resolve(); // unblock the ui thread
      if (signal.aborted) throw new DOMException('aborted!', 'AbortError');
    }

    for(const accessor of webgltf.accessors) {
      accessor.createWebGLBuffer(this.context);
      await Promise.resolve(); // unblock the ui thread
      if (signal.aborted) throw new DOMException('aborted!', 'AbortError');
    }
  }

  render(scene, cameraNode) {
    if(this.autoresize) this.resize();

    const { 
      context: gl, passes,
      graph, useIBL, usePunctual, useSSAO, debug, environment, defaultLights,
    } = this;

    const viewport = gl.canvas;

    environment?.createTextures(gl);

    graph.analyze({
      scene, cameraNode, viewport,
      useIBL, usePunctual, useSSAO, debug, environment
    });

    if(!graph.lights.length) {
      graph.lights.push(...defaultLights);
    }
    
    for(const pass of passes) {
      graph.passes[pass.name] = pass.render(graph);
    }
  }

  // renderNodePrimitive(node, primitive) {
  //   const program = this.getProgram(primitive, node);
  //   program.run(primitive, node, this.graph);
  // }

  // createProgram(primitive, node, additionalDefines = {}) {
  //   let program = this.programs.get(primitive);
  //   if (program) return program;

  //   program = new this.constructor.Program(this.context, primitive, node, this.graph, {
  //     ...additionalDefines,
  //     USE_IBL:      this.graph.environment && this.useIBL ? 1 : null,
  //     USE_PUNCTUAL: this.usePunctual ? 1 : null,
  //     USE_SSAO:     this.useSSAO ? 1 : null,
  //     SSAO_KERNEL_SIZE: this.useSSAO ? 16 : null,

  //     DEBUG: this.debug || 'DEBUG_NONE',
  //   });

  //   this.programs.set(primitive, program);
  //   return program;
  // }

  // getProgram(primitive, node) {
  //   return this.programs.get(primitive) || this.programs.set(primitive, this.createProgram(primitive, node)).get(primitive);
  // }

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

      if (this.environment) this.environment.createTextures(this.context);

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
          this.renderNodePrimitive(node, primitive, cameraPosition, viewMatrix, projectionMatrix, viewProjectionMatrix);
        }
      }
    }
  }

  clearProgramCache() {
    for(const pass of this.passes) {
      pass.clearProgramCache();
    }
  }
}

export default Renderer;
