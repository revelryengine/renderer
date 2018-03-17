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
  // isArray
  [true]: {
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
  getAttributes,
  getUniforms,
};
