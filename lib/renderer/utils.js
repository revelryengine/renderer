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

const componentTypeMap = {
  [GL.BYTE]: Int8Array,
  [GL.UNSIGNED_BYTE]: Uint8Array,
  [GL.SHORT]: Int16Array,
  [GL.UNSIGNED_SHORT]: Uint16Array,
  [GL.UNSIGNED_INT]: Uint32Array,
  [GL.FLOAT]: Float32Array,
};

const uniformSetters = {
  // isArray
  [true]: {
    [GL.FLOAT](context, location, value) {
      return context.uniform1fv(location, value);
    },
    [GL.INT](context, location, value) {
      return context.uniform1iv(location, value);
    },
    [GL.SAMPLER_CUBE](...args) {
      return this[GL.SAMPLER_2D](...args, GL.TEXTURE_CUBE_MAP);
    },
    [GL.SAMPLER_2D](context, location, value, samplers, bindTo = GL.TEXTURE_2D) {
      context.uniform1iv(location, samplers);
      for (let i = 0; i < value.length; i++) {
        context.activeTexture(context.TEXTURE0 + samplers[i]);
        context.bindTexture(bindTo, value[i]);
      }
    },
  },
  [false]: {
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
    [GL.SAMPLER_2D](context, location, value, samplers, bindTo = GL.TEXTURE_2D) {
      context.uniform1iv(location, [samplers[0]]);
      context.activeTexture(context.TEXTURE0 + samplers[0]);
      context.bindTexture(bindTo, value);
    },
  },
};

export function createShader(context, type, source) {
  const shader = context.createShader(type);
  context.shaderSource(shader, source);
  context.compileShader(shader);

  if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
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
    throw new Error(`Error linking program: ${log}`);
  }

  return program;
}

/**
 * Creates a texture in a WebGL context.
 * @param {WebGLRenderingContext} context - The WebGL context.
 * @param {Object} params - The parameters of the texture to create.
 * @param {Image} params.image - The image.
 * @param {Number} [params.magFilter=WebGLRenderingContext.LINEAR] - Magnification filter.
 * @param {Number} [params.minFilter=WebGLRenderingContext.LINEAR] - Minification filter.
 * @param {Number} [params.wrapS=WebGLRenderingContext.REPEAT] - s wrapping mode.
 * @param {Number} [params.wrapT=WebGLRenderingContext.REPEAT] - t wrapping mode.
 * @param {Number} [params.index=0] - The texture index.
 * @param {Number} [params.colorSpace=WebGLRenderingContext.RGBA] - The color space.
 */
export function createTexture(context, {
  image,
  magFilter = GL.LINEAR,
  minFilter = GL.LINEAR,
  wrapS = GL.REPEAT,
  wrapT = GL.REPEAT,
  index = 0,
  colorSpace = GL.RGBA,
}) {
  const texture = context.createTexture();
  context.activeTexture(context.TEXTURE0 + index);
  context.bindTexture(context.TEXTURE_2D, texture);

  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, wrapS);
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, wrapT);
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, minFilter);
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, magFilter);
  context.pixelStorei(context.UNPACK_FLIP_Y_WEBGL, false);
  context.texImage2D(context.TEXTURE_2D, 0, colorSpace, colorSpace, context.UNSIGNED_BYTE, image);

  return texture;
}

/**
 * Creates a buffer in a WebGL context.
 * @param {WebGLRenderingContext} context - The WebGL context.
 * @param {Object} params - The parameters of the buffer to create.
 * @param {ArrayBuffer} params.data - The data to create the buffer for.
 * @param {Number} [params.target=WebGLRenderingContext.ARRAY_BUFFER] - The target bind point.
 * @param {Number} [params.usage=WebGLRenderingContext.STATIC_DRAW] - The usage pattern of the data store.
 */
export function createBuffer(context, {
  data, target = GL.ARRAY_BUFFER, usage = GL.STATIC_DRAW,
  byteOffset = 0, byteLength,
}) {
  const buffer = context.createBuffer();
  context.bindBuffer(target, buffer);
  context.bufferData(target, data.slice(byteOffset, byteOffset + byteLength), usage);
  return buffer;
}


function createAttribSetter(context, location) {
  return (
    buffer, size, type = context.FLOAT,
    normalized = false, stride = 0, offset = 0, target = context.ARRAY_BUFFER,
  ) => {
    context.bindBuffer(target, buffer);
    context.enableVertexAttribArray(location);
    context.vertexAttribPointer(location, size, type, normalized, stride, offset);
  };
}

function createUniformSetter(context, location, type, name, size, samplers) {
  const isArray = (size > 1 && name.substr(-3) === '[0]');
  return value => uniformSetters[isArray][type](context, location, value, samplers);
}

function getSamplers(size, offset) {
  return Array.from(Array(size).keys(), i => i + offset);
}

function getArrayType(type) {
  return componentTypeMap[type];
}

export function getAttributes(context, program) {
  const attribs = {};

  for (let i = 0, l = context.getProgramParameter(program, context.ACTIVE_ATTRIBUTES); i < l; i++) {
    const { type, name, size } = context.getActiveAttrib(program, i);
    const location = context.getAttribLocation(program, name);

    attribs[name] = {
      location, type, name, size, set: createAttribSetter(context, location),
    };
  }

  return attribs;
}

export function getUniforms(context, program) {
  const uniforms = {};
  let samplerCount = 0;

  for (let i = 0, l = context.getProgramParameter(program, context.ACTIVE_UNIFORMS); i < l; i++) {
    const { type, name, size } = context.getActiveUniform(program, i);
    const location = context.getUniformLocation(program, name);

    let samplers;
    if (type === GL.SAMPLER_CUBE || type === GL.SAMPLER_2D) {
      samplers = getSamplers(size, samplerCount);
      samplerCount += size;
    }
    uniforms[name] = {
      location, type, name, size, samplers, set: createUniformSetter(context, location, type, name, size, samplers),
    };
  }

  return uniforms;
}

export default {
  createShader,
  createProgram,
  createTexture,
  createBuffer,
  getAttributes,
  getUniforms,
  getArrayType,
};
