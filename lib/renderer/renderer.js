import { mat4    } from '../utils/gl-matrix.js';
import { Frustum } from '../utils/frustum.js';
import { Graph   } from '../utils/graph.js';

import { StandardPipeline } from './pipeline.js';

import { Node  } from '../node.js';

import { KHRLightsPunctualLight } from '../extensions/KHR_lights_punctual.js';

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
  'EXT_color_buffer_float',
];

/**
 * A glTF scene renderer.
 */
export class Renderer {
  /**
   * Creates an instance of Renderer.
   *
   * @param {string|HTMLCanvasElement|WebGLRenderingContext} target - Can either be an HTMLCanvasElement, a selector, or
   * an existing WebGLRenderingContext. If an already initialized context is supplied, it should have antialias = false.
   */
  constructor(target, { settings, xrCompatible = false, scaleFactor = 1, pipeline } = {}) {
    this.settings = Object.assign({
      resizeCanvas: true,

      ibl:       { enabled: true },
      punctual:  { enabled: true },
      shadows:   { enabled: true, cascades: 3, lambda: 0.25, bias: 1 },
      ssao:      { enabled: true, bias: 0.025, radius: 0.5  },
      post:      { enabled: true },
      fog:       { enabled: false, range: [50, 100], color: [0,0,0,0] },
      dof:       { enabled: false, distance: 5, range: 5 },
      aabb:      { enabled: false },
      grid:      { enabled: false, increment: 1, colors: { thick: [1, 1, 1, 0.25], thin: [1, 1, 1, 0.1] } },
      debug:    'DEBUG_NONE',
    }, settings);

    let canvas;
    if (target instanceof WebGL2RenderingContext) {
      this.context = target;
    } else if (target instanceof HTMLCanvasElement) {
      canvas = target;
      this.context = canvas.getContext('webgl2', { xrCompatible, stencil: true, antialias: false }); // we need to disable antialias
    } else if (typeof target === 'string') {
      canvas = document.querySelector(target);
      this.context = canvas.getContext('webgl2', { xrCompatible, stencil: true, antialias: false }); // we need to disable antialias
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

    this.context.depthFunc(this.context.LEQUAL);
    this.context.colorMask(true, true, true, true);
    this.context.clearDepth(1.0);

    this.graph   = new Graph(this.context);
    this.frustum = new Frustum(this.context);

    this.defaultLights = [
      // new KHRLightsPunctualLight({ type: 'directional', intensity: 0.1 }).getUniformStruct(),
      // new KHRLightsPunctualLight({ type: 'directional', intensity: 0.1 }).getUniformStruct(
      //   mat4.fromRotation(mat4.create(), 3 * Math.PI / 4, [0, 1, -1])
      // ),
      new KHRLightsPunctualLight({ type: 'directional', intensity: 5 }).getUniformStruct(
        mat4.fromRotation(mat4.create(), 3 * Math.PI / 4, [-0.5, 1, 0])
      ),
    ];

    this.scaleFactor = scaleFactor;
    this.pipeline = new (pipeline || StandardPipeline)(this.context, this.settings);
  }

  /** 
   * Automatically resize the canvas based on offset dimensions and scaleFactor
   */
  resizeCanvas() {
    const { scaleFactor = 1, context: { canvas } } = this;

    const width  = Math.floor(canvas.offsetWidth * scaleFactor * window.devicePixelRatio);
    const height = Math.floor(canvas.offsetHeight * scaleFactor * window.devicePixelRatio);

    if (Math.abs(width - canvas.width) > 1 || Math.abs(height - canvas.height) > 1) {
      canvas.width  = width;
      canvas.height = height;
    }
  }

  // /**
  //  * @param {Object} viewport
  //  * dimensions.
  //  */
  // resize({ width, height }) {
  //   const { scaleFactor = 1 } = this;

  //   // width  *= scaleFactor;
  //   // height *= scaleFactor;

  //   this.pipeline.resize({ width, height });
  // }

  /**
   * Preload a WebGLTF object into WebGL. Asynchronously creates webgl textures and buffers.
   *
   * @param {WebGLTF} webgltf - The WebGLTF object to preload within the Renderer.
   */
  async preload(webgltf, abortCtl = {}) {
    const { signal } = abortCtl;
    for(const node of (webgltf.scene || webgltf.scenes[0]).depthFirstSearch()) {
      if(node.mesh) {
        for(const primitive of node.mesh.primitives) {
          if(primitive.indices) primitive.indices.createWebGLBuffer(this.context, this.context.ELEMENT_ARRAY_BUFFER);
          await Promise.resolve(); // unblock the ui thread
          if (signal?.aborted) throw new DOMException('aborted!', 'AbortError');
        }
      }
    }

    for(const texture of webgltf.textures) {
      texture.getWebGLTexture(this.context);
      await Promise.resolve(); // unblock the ui thread
      if (signal?.aborted) throw new DOMException('aborted!', 'AbortError');
    }

    for(const accessor of webgltf.accessors) {
      accessor.createWebGLBuffer(this.context);
      await Promise.resolve(); // unblock the ui thread
      if (signal?.aborted) throw new DOMException('aborted!', 'AbortError');
    }
  }

  /**
   * @typedef {Object} renderOutput
   * @property {Number} [x=0]
   * @property {Number} [y=0]
   * @property {Number} width
   * @property {Number} height
   * @property {WebGLFramebuffer} [framebuffer=null]
   */

  render(scene, cameraNode, output = this.context.canvas) {
    if(output === this.context.canvas && this.settings.resizeCanvas) this.resizeCanvas();

    const { context: gl, pipeline, frustum, graph, environment, defaultLights } = this;

    let { width, height } = output;
    if(output !== this.context.canvas) {
      width  = Math.floor(width * this.scaleFactor);
      height = Math.floor(height * this.scaleFactor);
    }

    frustum.bind();
    frustum.update({ graph, cameraNode, viewport: { width, height } });

    // graph.bind?.();
    graph.update({ scene });

    if(!graph.lights.length) {
      graph.lights.push(...defaultLights);
    }

    environment?.createTextures(gl);
    graph.environment = environment; //Until KHR_lights_environment is ratified the environment should be set manually.

    pipeline.run({ graph, frustum, output });
  }

  renderXR(scene, xrRefSpace, xrFrame) {
    const pose = xrFrame.getViewerPose(xrRefSpace);

    if(pose) {

      const glLayer = xrFrame.session.renderState.baseLayer;
      const { framebuffer } = glLayer;
      
      for (const view of pose.views) {
        const { x, y, width, height } = glLayer.getViewport(view);
        
        const cameraNode = new Node({ 
          matrix: pose.transform.matrix, 
          camera: { 
            getProjectionMatrix(out) { 
              mat4.copy(out, view.projectionMatrix);
            } 
          }
        });
        this.render(scene, cameraNode, { framebuffer, x, y, width, height });
      }
    }
  }

  reset() {
    this.pipeline.reset();
  }

  getPointInfo(x, y) {
    const { context: gl } = this;
    
    const { width, height, framebuffer } = this.pipeline.base.fbo;

    const xRatio = this.pipeline.width / width;
    const yRatio = this.pipeline.height / height;

    const output = new Float32Array(4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.readBuffer(gl.COLOR_ATTACHMENT1);
    gl.readPixels(x / xRatio, y / yRatio, 1, 1, gl.RGBA, gl.FLOAT, output);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    
    return output;
  }

  getDistanceAtPoint(x, y) {
    const [z] = this.getPointInfo(x, y); 
    return this.frustum.getLinearDepth(z);
  }

  getPrimitiveAtPoint(x, y) {
    const { context: gl } = this;

    const { width, height, framebuffer } = this.pipeline.base.fbo;

    const xRatio = this.pipeline.width / width;
    const yRatio = this.pipeline.height / height;

    const output = new Uint32Array(2);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.readBuffer(gl.COLOR_ATTACHMENT2);
    gl.readPixels(x / xRatio, y / yRatio, 1, 1, gl.RG_INTEGER, gl.UNSIGNED_INT, output);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    for(const { node, primitive} of this.frustum.iteratePrimitives()) {
      if(primitive.$id === output[0] && node.$id === output[1]){
        return { node,  primitive };
      }
    }

    return null;
  }
}

export default Renderer;
