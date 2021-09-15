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

const GL = WebGL2RenderingContext;

const SAMPLERS_2D = [
  GL.SAMPLER_2D,
  GL.SAMPLER_2D_ARRAY,
  GL.SAMPLER_2D_SHADOW,
  GL.SAMPLER_2D_ARRAY_SHADOW,
];

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
  [GL.UNSIGNED_INT](context, location, value) {
    return context.uniform1ui(location, value);
  },
  [GL.UNSIGNED_INT_VEC2](context, location, value) {
    return context.uniform2uiv(location, value);
  },
  [GL.UNSIGNED_INT_VEC3](context, location, value) {
    return context.uniform3uiv(location, value);
  },
  [GL.UNSIGNED_INT_VEC4](context, location, value) {
    return context.uniform4uiv(location, value);
  },
  [GL.BOOL](context, location, value) {
    return context.uniform1i(location, value);
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
  [GL.SAMPLER_2D_SHADOW](...args) {
    return this[GL.SAMPLER_2D](...args, GL.TEXTURE_2D);
  },
  [GL.SAMPLER_2D_ARRAY_SHADOW](...args) {
    return this[GL.SAMPLER_2D](...args, GL.TEXTURE_2D_ARRAY);
  },
  [GL.SAMPLER_2D_ARRAY](...args) {
    return this[GL.SAMPLER_2D](...args, GL.TEXTURE_2D_ARRAY);
  },
  [GL.SAMPLER_2D](context, location, value, samplers, target = GL.TEXTURE_2D) {
    context.uniform1i(location, samplers[0]);
    context.activeTexture(GL.TEXTURE0 + samplers[0]);
    context.bindTexture(target, value);
  },
};

const uniformArraySetters = {
  [GL.FLOAT](context, location, value) {
    return context.uniform1fv(location, value);
  },
  [GL.INT](context, location, value) {
    return context.uniform1iv(location, value);
  },
  [GL.BOOL](context, location, value) {
    return context.uniform1iv(location, value);
  },
}

/**
 * With these types we are already leveraging the uniform (v) methods
 * @see: https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/uniform
 */
const SIMPLE_VECTOR_TYPES = [
  GL.FLOAT_VEC2,
  GL.FLOAT_VEC3,
  GL.FLOAT_VEC4,
  GL.INT_VEC2,
  GL.INT_VEC3,
  GL.INT_VEC4,
  GL.UNSIGNED_INT_VEC2,
  GL.UNSIGNED_INT_VEC3,
  GL.UNSIGNED_INT_VEC4,
  GL.BOOL_VEC2,
  GL.BOOL_VEC3,
  GL.BOOL_VEC4,
  GL.FLOAT_MAT2,
  GL.FLOAT_MAT3,
  GL.FLOAT_MAT4,
];

function createShader(context, type, source) {
  const shader = context.createShader(type);
  context.shaderSource(shader, source);
  context.compileShader(shader);
  return shader;
}

function checkShaderStatus(context, shader) {
  if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    console.warn('Failed to create shader', context.getShaderSource(shader));

    const log = context.getShaderInfoLog(shader);
    const src = context.getShaderSource(shader);
    console.warn(src.split('\n').map((line, i) => `${i + 1}: ${line}`).join('\n'));
    console.warn(`Error compiling shader: ${log}`);

    context.deleteShader(shader);
    throw new Error(`Error compiling shader: ${log}`);
  }
}

function checkProgramStatus(context, program){
  if (!context.getProgramParameter(program, context.LINK_STATUS)) {
    const log = context.getProgramInfoLog(program);
    context.deleteProgram(program);
    console.warn('Failed to create program', log);
    throw new Error(`Error linking program: ${log}`);
  }
}

function createProgram(context, vShader, fShader) {
  const program = context.createProgram();
  context.attachShader(program, vShader);
  context.attachShader(program, fShader);
  context.linkProgram(program);
  return program;
}

function getSamplers(size, offset) {
  return Array.from(Array(size).keys(), i => i + offset);
}

const attributeSetters = {
  generic(context, location, { target, buffer, size, type, normalized, stride, offset = 0, integer = false, divisor, subData } ){
    context.bindBuffer(target, buffer);
    context.enableVertexAttribArray(location);

    if(integer) {
      context.vertexAttribIPointer(location, size, type, stride, offset);
    } else {
      context.vertexAttribPointer(location, size, type, normalized, stride, offset);
    }
    
    if(divisor) context.vertexAttribDivisor(location, divisor);
    if(subData) {
      const { arrayBuffer, offset = 0, length = 0 } = subData;
      context.bufferSubData(target, offset, arrayBuffer, length);
    }
  },
  matrix(context, location, columns, { target, buffer, size, type, normalized, stride, offset = 0, divisor, subData }) {
    context.bindBuffer(target, buffer);

    const offsetSize = Math.pow(columns, 2); //2x2, 3x3, 4x4
    for(let i = 0; i < columns; i++) {
      context.enableVertexAttribArray(location + i);
      context.vertexAttribPointer(location + i, size, type, normalized, stride, offset + (i * offsetSize));
      if(divisor) context.vertexAttribDivisor(location + i, divisor);
    }
    
    if(subData) {
      const { arrayBuffer, offset = 0, length = 0 } = subData;
      context.bufferSubData(target, offset, arrayBuffer, length);
    }
  },
  [GL.FLOAT_MAT2](context, location, attribute) {
    return this.matrix(context, location, 2, attribute);
  },
  [GL.FLOAT_MAT3](context, location, attribute) {
    return this.matrix(context, location, 3, attribute);
  },
  [GL.FLOAT_MAT4](context, location, attribute) {
    return this.matrix(context, location, 4, attribute);
  }
}

function createAttribSetter(context, location, type) {
  if(attributeSetters[type]) {
    return value => attributeSetters[type](context, location, value);
  }
  return value => attributeSetters.generic(context, location, value);
}

function createUniformSetter(context, location, type, samplers) {
  return value => uniformSetters[type](context, location, value, samplers);
}

function createStructUniformSetter(name, propSetters) {
  return valueStruct => {
    for(const key in valueStruct){
      if(valueStruct[key]) propSetters[key]?.(valueStruct[key]);
    }
  };
}

function createArrayUniformSetter(context, location, type, name, setters) {
  if(uniformArraySetters[type]){
    return valueArray => uniformArraySetters[type](context, location, valueArray);
  }
  return valueArray => {
    for(let i = 0; i < valueArray.length; i++){
      if(valueArray[i]) setters[`${name}[${i}]`]?.(valueArray[i]);
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
    this.setters   = {};
    this.locations = {};

    for (let i = 0, l = context.getProgramParameter(program, context.ACTIVE_ATTRIBUTES); i < l; i++) {
      const { name, type, size } = context.getActiveAttrib(program, i);
      const location = context.getAttribLocation(program, name);

      this.setters[name]   = createAttribSetter(context, location, type, size);
      this.locations[name] = location;
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
    this.setters   = {};
    this.locations = {};

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
      * 
      * Be careful with this. If you see something like the following message:
      * 
      * "Two textures of different types use the same sampler location."
      * 
      * This means that you are not updating the sampler locations and they default to TEXTURE0.
      * You MUST run an update for all samplers exposed in the shader.
      * This may change depending on the DEFINE values becuase they get compiled out.
      */

      if (SAMPLERS_2D.indexOf(type) !== -1) {
        samplers = getSamplers(size, samplerCount);
        samplerCount += size;
      } else if (type === GL.SAMPLER_CUBE) {
        samplers = getSamplers(size, cubeSamplerCount).map(v => maxTextures - v);
        cubeSamplerCount += size;
      }

      this.setters[name]   = createUniformSetter(context, location, type, samplers);
      this.locations[name] = location;

      if(name.endsWith('[0]')){
        const subName = name.substring(0, name.length - 3);
        if(SIMPLE_VECTOR_TYPES.includes(type)) {
          this.setters[subName] = this.setters[name];
        } else {
          this.setters[subName] = createArrayUniformSetter(context, location, type, subName, this.setters);
        }
        this.locations[subName] = location;
      }
      if(name.includes('.')) {
        const [struct, prop] = name.split('.');
        structs[struct] = structs[struct] || {};
        structs[struct][prop] = this.setters[name];
      }
    }

    for(const struct in structs){
      const propSetters = structs[struct];
      this.setters[struct] = createStructUniformSetter(struct, propSetters);

      if(struct.endsWith('[0]')) {
        const subName = struct.substring(0, struct.length - 3);
        this.setters[subName] = createArrayUniformSetter(context, this.locations[subName], null, subName, this.setters);
      }
    }
  }
  set(name, value) {
    if (value != undefined && this.setters[name]) {
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
 * A WeakMap keyed by context containing a Map of programs keyed by shader src and define str, to clear the cache call Program.clearCache(context);
 */
const contextCache = new WeakMap();

/**
 * A class for creating WebGL shader programs.
 */
export class Program {
  static vertexShaderSrc = '';
  static fragmentShaderSrc = '';

  /**
   * Creates an instance of Program.
   * @param {WebGLRenderingContext} context - The WebGL context to create the shader with.
   * @param {Object} [defines={}] - An object of key value pairs to add as #define key value in shaders.
   */
  constructor(context, { defines = {}, settings } = {}) {
    const cache = contextCache.get(context) || contextCache.set(context, new Map()).get(context);

    const { vertexShaderSrc, fragmentShaderSrc } = this.constructor;

    const defineStr = Object.entries(this.define(defines)).map(([key, val]) => `#define ${key} ${val}`).join('\n');
    const key = this.constructor.name + vertexShaderSrc + fragmentShaderSrc + defineStr;
    const fromCache = cache.get(key);

    if(fromCache) return fromCache;

    /**
     * The WebGL context the shader was created with.
     * @type {WebGLRenderingContext}
     */
    this.context = context;

    /**
     * The vertex shader source.
     * @type {String}
     */
    this.vertexShaderSrc = vertexShaderSrc;

    /**
     * The fragment shader source.
     * @type {String}
     */
    this.fragmentShaderSrc = fragmentShaderSrc;

    /**
     * The define string to prepend to shader src
     * @type {String}
     */
    this.defineStr = defineStr;

    /**
     * The vertex shader. Is null until program is compiled.
     * @type {WebGLShader}
     */
    this.vertexShader = null;

    /**
     * The fragment shader. Is null until program is compiled.
     * @type {WebGLShader}
     */
    this.fragmentShader = null;

    /**
     * The WebGL program. Is null until program is compiled.
     * @type {WebGLProgram}
     */
    this.program = null;

    /**
     * An attribute map for setting attribute values. Is null until program is compiled.
     * @type {AttributeMap}
     */
    this.attributes = null;

    /**
     * A uniform map for setting uniform values. Is null until program is compiled.
     * @type {UniformMap}
     */
    this.uniforms = null;

    /**
     * An object of key value pairs added #define key value in shaders.
     * @type {Object}
     */
    this.defines = Object.freeze(defines);

    /**
     * A boolean indicating that shader and progam compilation is complete.
     * @type {boolean}
     */
    this.compiled = false;

    this.settings = settings;

    cache.set(key, this);
  }

  define(defines) {
    return Object.fromEntries(Object.entries(defines).filter(([,val]) => val !== null));
  }

  async compile({ sync = false } = {}, abortCtl){
    if(this.compiled) return;

    const { context, defineStr, vertexShaderSrc, fragmentShaderSrc } = this;

    this.vertexShader   = createShader(context, context.VERTEX_SHADER, `#version 300 es\n${defineStr}\n${vertexShaderSrc}`);
    this.fragmentShader = createShader(context, context.FRAGMENT_SHADER, `#version 300 es\n${defineStr}\n${fragmentShaderSrc}`);
    this.program        = createProgram(context, this.vertexShader, this.fragmentShader);

    const ext = context.getExtension('KHR_parallel_shader_compile');

    if (ext && !sync) {
      do {
        await new Promise(resolve => setTimeout(resolve));
        if(abortCtl?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      } while(!context.getProgramParameter(this.program, ext.COMPLETION_STATUS_KHR))
    }

    checkShaderStatus(context, this.vertexShader);
    checkShaderStatus(context, this.fragmentShader);
    checkProgramStatus(context, this.program);

    this.attributes = new AttributeMap(context, this.program);
    this.uniforms   = new UniformMap(context, this.program);
    this.compiled   = true;
  }

  update() {
    this.attributes.update();
    this.uniforms.update();
  }

  use() {
    if(!this.compiled) this.compile({ sync: true });
    this.context.useProgram(this.program);
  }

  run() {
    this.use();
  }

  draw() {
    Program.drawCalls++;
  }

  static drawCalls = 0;

  static clearCache(context) {
    const cache = contextCache.get(context);
    if(cache) cache.clear();
  }
}

export default Program;