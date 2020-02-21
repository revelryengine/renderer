/** Attribute setter function
  @name attributeSetter
  @function
  @param {any} value The value to set the attribute to.
*/

/** Uniform setter function
  @name uniformSetter
  @function
  @param {any} value The value to set the attribute to.
*/

/**
 * An object containing basic information for a WebGL Program attribute and the attribute location.
 * @typedef {WebGLActiveInfo} attributeInfo
 * @property {Number} location - The WebGL attribute location.
 * @property {attributeSetter} set - A method to set the value of the attribute for the context.
 */

/**
 * An object containing basic information for a WebGL Program uniform and the uniform location.
 * @typedef {WebGLActiveInfo} uniformInfo
 * @property {WebGLUniformLocation} location - The WebGL uniform location.
 * @property {uniformSetter} set - A method to set the value of the uniform for the context.
 * @property {Number[]} [samplers] - An array of sampler indices for the uniform.
 */

const GL = WebGLRenderingContext;

const uniformSetters = {
  [GL.FLOAT](context, location, value) {
    return context.uniform1f(location, value);
  },
  [GL.FLOAT_VEC2](context, location, value) {
    return context.uniform2fv(location, value);
  },
  [GL.FLOAT_VEC3](context, location, value) {
    return context.uniform3fv(location, value);
  },
  [GL.FLOAT_VEC4](context, location, value) {
    return context.uniform4fv(location, value);
  },
  [GL.INT](context, location, value) {
    return context.uniform1i(location, value);
  },
  [GL.INT_VEC2](context, location, value) {
    return context.uniform2iv(location, value);
  },
  [GL.INT_VEC3](context, location, value) {
    return context.uniform3iv(location, value);
  },
  [GL.INT_VEC4](context, location, value) {
    return context.uniform4iv(location, value);
  },
  [GL.BOOL](context, location, value) {
    return context.uniform1iv(location, value);
  },
  [GL.BOOL_VEC2](context, location, value) {
    return context.uniform2iv(location, value);
  },
  [GL.BOOL_VEC3](context, location, value) {
    return context.uniform3iv(location, value);
  },
  [GL.BOOL_VEC4](context, location, value) {
    return context.uniform4iv(location, value);
  },
  [GL.FLOAT_MAT2](context, location, value) {
    return context.uniformMatrix2fv(location, false, value);
  },
  [GL.FLOAT_MAT3](context, location, value) {
    return context.uniformMatrix3fv(location, false, value);
  },
  [GL.FLOAT_MAT4](context, location, value) {
    return context.uniformMatrix4fv(location, false, value);
  },
  [GL.SAMPLER_CUBE](...args) {
    return this[GL.SAMPLER_2D](...args, GL.TEXTURE_CUBE_MAP);
  },
  // [GL.SAMPLER_CUBE](context, location, value, samplers, bindTo = GL.TEXTURE_CUBE_MAP) {
  //   context.uniform1iv(location, [31 - samplers[0]]);
  //   context.activeTexture(GL.TEXTURE31 - samplers[0]);
  //   context.bindTexture(bindTo, value);
  // },
  [GL.SAMPLER_2D](context, location, value, samplers, bindTo = GL.TEXTURE_2D) {
    context.uniform1iv(location, [samplers[0]]);
    context.activeTexture(GL.TEXTURE0 + samplers[0]);
    context.bindTexture(bindTo, value);
  },
};

const uniformArraySetters = {
  [GL.FLOAT](context, location, value) {
    return context.uniform1fv(location, value);
  },
  [GL.INT](context, location, value) {
    return context.uniform1iv(location, value);
  },
  [GL.FLOAT_MAT4](context, location, value) {
    return context.uniformMatrix4fv(location, false, value);
  },
  [GL.SAMPLER_CUBE](...args) {
    return this[GL.SAMPLER_2D](...args, GL.TEXTURE_CUBE_MAP);
  },
  [GL.SAMPLER_2D](context, location, value, samplers, bindTo = GL.TEXTURE_2D) {
    context.uniform1iv(location, samplers);
    for (let i = 0; i < value.length; i++) {
      context.activeTexture(samplers[i]);
      context.bindTexture(bindTo, value[i]);
    }
  },
}

export function createShader(context, type, source) {
  const shader = context.createShader(type);
  context.shaderSource(shader, source);
  context.compileShader(shader);

  if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    console.warn('Failed to create shader', source);
    const log = context.getShaderInfoLog(shader);
    context.deleteShader(shader);
    throw new Error(`Error compiling shader: ${log}`);
  }

  return shader;
}

export function createProgram(context, vShader, fShader) {
  const program = context.createProgram();
  context.attachShader(program, vShader);
  context.attachShader(program, fShader);
  context.linkProgram(program);
  context.validateProgram(program);

  if (!context.getProgramParameter(program, context.LINK_STATUS)) {
    const log = context.getProgramInfoLog(program);
    context.deleteProgram(program);
    console.warn('Failed to create program', vShader, fShader);
    throw new Error(`Error linking program: ${log}`);
  }

  return program;
}


function getSamplers(size, offset) {
  return Array.from(Array(size).keys(), i => i + offset);
}

function createAttribSetter(context, location) {
  return (accessor) => {
    const {
      bufferView: { byteStride = accessor.getElementSize(), target = context.ARRAY_BUFFER } = {},
      componentType = context.FLOAT, normalized = false, byteOffset = 0,
    } = accessor;
    const numberOfComponents = accessor.getNumberOfComponents();
    const buffer = accessor.getWebGLBuffer(context);

    context.bindBuffer(target, buffer);
    context.enableVertexAttribArray(location);
    context.vertexAttribPointer(location, numberOfComponents, componentType, normalized, byteStride, byteOffset);
  };
}

function createUniformSetter(context, location, type, name, size, samplers) {
  const isArray = (size > 1 && name.endsWith('[0]'));
  return value => (isArray ? uniformArraySetters : uniformSetters)[type](context, location, value, samplers);
}

function createStructUniformSetter(name, propSetters) {
  return value => {
    for(const [key, prop] of Object.entries(value)){
      if(prop && propSetters[key]) {
        propSetters[key](prop);
      }
    }
  };
}
/**
 * An attribute map is used to store and set attribute values from Accessors. Setting an attribute will store it in a
 * queue to be sent to the program when update is called.
 */
class AttributeMap extends Map {
  constructor(context, program) {
    super();

    this.queue = new Set();
    this.setters = {};

    for (let i = 0, l = context.getProgramParameter(program, context.ACTIVE_ATTRIBUTES); i < l; i++) {
      const { name } = context.getActiveAttrib(program, i);
      const location = context.getAttribLocation(program, name);

      this.setters[name] = createAttribSetter(context, location);
    }
  }
  set(name, accessor) {
    if (accessor && this.setters[name]) {
      this.queue.add(name);
      super.set(name, accessor);
    }
  }

  update() {
    for (const name of this.queue) {
      this.setters[name](this.get(name));
    }
    this.queue.clear();
  }
}

class UniformMap extends Map {
  constructor(context, program) {
    super();

    this.queue = new Set();
    this.setters = {};

    let samplerCount = 0;
    let cubeSamplerCount = 0;

    const uniformCount = context.getProgramParameter(program, context.ACTIVE_UNIFORMS);
    const maxTextures = context.getParameter(context.MAX_COMBINED_TEXTURE_IMAGE_UNITS) - 1;

    const structs = {};

    for (let i = 0; i < uniformCount; i++) {
      const { type, name, size } = context.getActiveUniform(program, i);

      const location = context.getUniformLocation(program, name);
      let samplers;

       /**
       * Because we can't reuse texture slots for different types (2D/Cube),
       * we need to assign textures slots carefully.
       * Standard textures should count up from 0, and cube maps should count down from max
       */

      if (type === GL.SAMPLER_2D) {
        samplers = getSamplers(size, samplerCount);
        samplerCount += size;
      } else if (type === GL.SAMPLER_CUBE) {
        samplers = getSamplers(size, cubeSamplerCount).map(v => maxTextures - v);
        cubeSamplerCount += size;
      }

      this.setters[name] = createUniformSetter(context, location, type, name, size, samplers);

      if(name.endsWith('[0]')){
        this.setters[name.substring(0, name.length - 3)] = this.setters[name];
      }
      if(name.includes('.')) {
        const [struct, prop] = name.split('.');
        structs[struct] = structs[struct] || {};
        structs[struct][prop] = this.setters[name];
      }
    }

    for(const [struct, propSetters] of Object.entries(structs)){
      this.setters[struct] = createStructUniformSetter(struct, propSetters);

      if(struct.endsWith('[0]')) {
        const structName = struct.substring(0, struct.length - 3);
        this.setters[structName] = valueArray => {
          for(let i = 0; i < valueArray.length; i++){
            this.setters[`${structName}[${i}]`](valueArray[i]);
          }
        }
      }
    }
  }
  set(name, value) {
    if (value && this.setters[name]) {
      this.queue.add(name);
      super.set(name, value);
    }
  }

  update() {
    for (const name of this.queue) {
      this.setters[name](this.get(name));
    }
    this.queue.clear();
  }
}

/**
 * A class for creating WebGL shader programs.
 */
export class Program {
  /**
   * Creates an instance of Program.
   * @param {WebGLRenderingContext} context - The WebGL context to create the shader with.
   * @param {String} vertexShaderSrc - The vertext shader source.
   * @param {String} fragmentShaderSrc - The fragment shader source.
   * @param {Object} [define={}] - An object of key value pairs to add as #define key value in shaders.
   */
  constructor(context, vertexShaderSrc, fragmentShaderSrc, define = {}) {
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
    this.vertexShader = createShader(context, context.VERTEX_SHADER, `#version 300 es\n${defineStr}\n${vertexShaderSrc}`);

    /**
     * The fragment shader.
     * @type {WebGLShader}
     */
    this.fragmentShader = createShader(context, context.FRAGMENT_SHADER, `#version 300 es\n${defineStr}\n${fragmentShaderSrc}`);

    /**
     * The WebGL program
     * @type {WebGLProgram}
     */
    this.program = createProgram(context, this.vertexShader, this.fragmentShader);

    /**
     * An attribute map for setting attribute values.
     * @type {AttributeMap}
     */
    this.attributes = new AttributeMap(context, this.program);

    /**
     * A uniform map for setting uniform values.
     * @type {UniformMap}
     */
    this.uniforms = new UniformMap(context, this.program);

    /**
     * An object of key value pairs added #define key value in shaders.
     * @type {Object}
     */
    this.define = Object.freeze(define);
  }

  update() {
    this.attributes.update();
    this.uniforms.update();
  }

  use() {
    this.context.useProgram(this.program);
  }

  run() {
    this.use();
  }
}

export default Program;
