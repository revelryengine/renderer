import { WebGLTF, Mesh, Scene, Primitive, Node, glMatrix } from '../webgltf.js';

import { KHRLightsPunctualLight } from '../extensions/KHR_lights_punctual.js';

import { PBRProgram } from './pbr-program.js';
import { Graph } from './graph.js';

const { mat4, vec3 } = glMatrix;

/**
 * @external {HTMLCanvasElement} https://developer.mozilla.org/en/docs/Web/API/HTMLCanvasElement
 * @external {WebGLRenderingContext} https://developer.mozilla.org/en/docs/Web/API/WebGLRenderingContext
 */

// const GL = WebGLRenderingContext;

const GL_EXTENSIONS = [
  "EXT_shader_texture_lod",
  "OES_standard_derivatives",
  "OES_element_index_uint",
  "EXT_texture_filter_anisotropic",
  "OES_texture_float",
  "OES_texture_float_linear"
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

    const glExtensions = {};
    for(const ext of GL_EXTENSIONS) {
      glExtensions[ext] = this.context.getExtension(ext);
    }
    this.glExtensions = Object.freeze(glExtensions);

    this.context.enable(this.context.DEPTH_TEST);
    this.context.depthFunc(this.context.LEQUAL);
    this.context.colorMask(true, true, true, true);
    this.context.clearDepth(1.0);

    this.resizeCanvas();

    this.environment = environment;
    if (this.environment) {
      this.environment.createTextures(this.context);
    }

    this.graph = new Graph();
    this.programs = new WeakMap();

    this.lights = [];
    this.defaultLight = (new KHRLightsPunctualLight({ type: 'directional' })).getUniformStruct();
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
      primitive.createWebGLProgram(context, this.environment, this.glExtensions);
    } else {
      throw new Error('Unknown object type');
    }
  }

  render(scene, cameraNode) {
    const { context: gl } = this;

    this.resizeCanvas();

    this.graph.update(cameraNode); // come back to this
    this.graph.analyze(scene);


    this.lights = [...this.graph.lights.map(({ struct }) => struct)];

    if(!this.lights.length) {
      this.lights.push(this.defaultLight);
    }

    this.ibl = this.graph.ibl;

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

    const program = this.getProgram(primitive);

    program.run(
      primitive,
      cameraPosition, modelMatrix, viewProjectionMatrix, normalMatrix,
      jointMatrices, jointNormalMatrices, morphWeights, this.lights, this.ibl
    );
  }

  createProgram(primitive) {
    let program = this.programs.get(primitive);
    if (program) return program;

    const { context, lights, ibl, glExtensions } = this;

    program = new PBRProgram(context, { primitive, lights, ibl, glExtensions });

    this.programs.set(primitive, program);
    return program;
  }

  getProgram(primitive) {
    return this.programs.get(primitive) || this.programs.set(primitive, this.createProgram(primitive)).get(primitive);
  }
}

export default Renderer;
