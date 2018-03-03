import { createShader, createProgram, getAttributes, getUniforms } from './utils.js';
/**
 * A class for creating WebGL shader programs.
 */
export class Program {
  /**
   * Creates an instance of Program.
   * @param {Object} params - The Program parameters.
   * @param {WebGLRenderingContext} params.context - The WebGL context to create the shader with.
   * @param {String} params.vertexShaderSrc - The vertext shader source.
   * @param {String} params.fragmentShaderSrc - The fragment shader source.
   * @param {Object} [params.define={}] - An object of key value pairs to add as #define key value in shaders.
   */
  constructor({ context, vertexShaderSrc, fragmentShaderSrc, define = {} }) {
    const defineStr = Object.entries(define).map(([key, val]) => `#define ${key} ${val}`).join('\n');

    /**
     * The WebGL context the shader was created with.
     * @type {WebGLRenderingContext}
     */
    this.context = context;

    /**
     * The vertex shader.
     * @type {WebGLShader}
     */
    this.vertexShader = createShader(context, context.VERTEX_SHADER, `${defineStr}\n${vertexShaderSrc}`);

    /**
     * The fragment shader.
     * @type {WebGLShader}
     */
    this.fragmentShader = createShader(context, context.FRAGMENT_SHADER, `${defineStr}\n${fragmentShaderSrc}`);

    /**
     * The WebGL program
     * @type {WebGLProgram}
     */
    this.program = createProgram(context, this.vertexShader, this.fragmentShader);

    /**
     * An object containing all of the attributes mapped by name.
     * @type {Object.<attributeInfo.name, attributeInfo>}
     */
    this.attributes = getAttributes(context, this.program);

    /**
     * An object containing all of the uniforms mapped by name.
     * @type {Object.<uniformInfo.name, uniformInfo>}
     */
    this.uniforms = getUniforms(context, this.program);

    /**
     * An object of key value pairs added #define key value in shaders.
     * @type {Object}
     */
    this.define = Object.freeze(define);
  }

  use() {
    this.context.useProgram(this.program);
  }

  run() {
    this.use();
  }
}

export default Program;
