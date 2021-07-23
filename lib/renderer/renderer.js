import { mat4 } from '../utils/gl-matrix.js';

import { Graph } from './graph.js';

import { Node  } from '../node.js';

import { KHRLightsPunctualLight } from '../extensions/KHR_lights_punctual.js';

import { RenderPass     } from './passes/render-pass.js';
import { BasePass       } from './passes/base-pass.js';
import { SSAOPass       } from './passes/ssao-pass.js';
import { PBRPass        } from './passes/pbr-pass.js';

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
   * an existing WebGLRenderingContext. If an already initialized context is supplied, it should have antialias = false.
   */
  constructor(target, { settings, xrCompatible = false } = {}) {
    this.settings = Object.assign({
      resizeCanvas: true,

      ibl:      { enabled: true },
      punctual: { enabled: true },
      ssao:     { enabled: true, bias: 0.025, radius: 0.5 },
      debug:    'DEBUG_NONE',
    }, settings);

    let canvas;
    if (target instanceof WebGL2RenderingContext) {
      this.context = target;
    } else if (target instanceof HTMLCanvasElement) {
      canvas = target;
      this.context = canvas.getContext('webgl2', { xrCompatible, antialias: false }); // we need to disable antialias
    } else if (typeof target === 'string') {
      canvas = document.querySelector(target);
      this.context = canvas.getContext('webgl2', { xrCompatible, antialias: false }); // we need to disable antialias
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

    this.graph = new Graph(this.settings);

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

    this.passes = [
      new BasePass('base', this.context),
      new SSAOPass('ssao', this.context),
      new PBRPass('pbr',   this.context),
    ];
  }

  /** 
   * Automatically resize the canvas based on offset dimensions and scaleFactor
   */
  resizeCanvas() {
    const { scaleFactor = 1, context: { canvas } } = this;

    const width  = canvas.offsetWidth * scaleFactor;
    const height = canvas.offsetHeight * scaleFactor;

    if (Math.abs(width - canvas.width) > 1 || Math.abs(height - canvas.height) > 1) {
      
      canvas.width  = width;
      canvas.height = height;
    }
  }

  /**
   * @param {Object} viewport
   * dimensions.
   */
  resize({ width, height }) {
    const { scaleFactor = 1 } = this;

    width  *= scaleFactor;
    height *= scaleFactor;

    for(const pass of this.passes) {
      pass.resize({ width, height });
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

    const { context: gl, passes, graph, environment, defaultLights } = this;

    environment?.createTextures(gl);

    const { width, height } = output;

    this.resize({ width, height });

    graph.analyze({ scene, cameraNode, viewport: { width: width * this.scaleFactor, height: height * this.scaleFactor }, environment });

    if(!graph.lights.length) {
      graph.lights.push(...defaultLights);
    }
    
    for(const pass of passes) {
      graph.passes[RenderPass.previous] = graph.passes[pass.name] = pass.render(graph);
    }

    //Blit last pass to the output framebuffer
    RenderPass.blitFramebuffer(gl,  graph.passes[RenderPass.previous], output, gl.COLOR_BUFFER_BIT);
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
            getProjectionMatrix() { 
              return view.projectionMatrix;
            } 
          }
        });
        this.render(scene, cameraNode, { framebuffer, x, y, width, height });
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
