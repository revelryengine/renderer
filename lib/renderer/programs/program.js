/** Attribute setter function
* @name attributeSetter
* @function
* @param {any} value The value to set the attribute to.
*/

/** Uniform setter function
* @name uniformSetter
* @function
* @param {any} value The value to set the attribute to.
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
    [GL.SAMPLER_2D](context, location, value) {
        return context.uniform1i(location, value);
    },
    [GL.SAMPLER_2D_ARRAY](context, location, value) {
        return context.uniform1i(location, value);
    },
    [GL.SAMPLER_CUBE](context, location, value) {
        return context.uniform1i(location, value);
    },
    [GL.SAMPLER_2D_SHADOW](context, location, value) {
        return context.uniform1i(location, value);
    },
    [GL.SAMPLER_2D_ARRAY_SHADOW](context, location, value) {
        return context.uniform1i(location, value);
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

const SAMPLER_TARGETS = {
    [GL.SAMPLER_2D]:              GL.TEXTURE_2D,
    [GL.SAMPLER_2D_ARRAY]:        GL.TEXTURE_2D_ARRAY,
    [GL.SAMPLER_CUBE]:            GL.TEXTURE_CUBE_MAP,
    [GL.SAMPLER_CUBE_SHADOW]:     GL.TEXTURE_CUBE_MAP,
    [GL.SAMPLER_2D_SHADOW]:       GL.TEXTURE_2D,
    [GL.SAMPLER_2D_ARRAY_SHADOW]: GL.TEXTURE_2D_ARRAY,
    [GL.SAMPLER_3D]:              GL.TEXTURE_3D,
}

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
            const { arrayBuffer, offset: srcOffset = 0, length = 0 } = subData;
            context.bufferSubData(target, offset, arrayBuffer, srcOffset, length);
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
            const { arrayBuffer, offset: srcOffset = 0, length = 0 } = subData;
            context.bufferSubData(target, offset, arrayBuffer, srcOffset, length);
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

function createUniformSetter(context, location, type) {
    return value => uniformSetters[type](context, location, value);
}

function createStructUniformSetter(propSetters) {
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

function createSamplerSetter(context, location, target = GL.TEXTURE_2D) {
    return (texture) => {
        context.activeTexture(context.TEXTURE0 + location);
        context.bindTexture(target, texture);
    }
}

function createBlockSetter(context, location, program) {
    return (index) => {
        context.uniformBlockBinding(program, index, location);
    }
}

class ShaderSetter {
    setters   = {};
    locations = {};
    
    set(name, value) {
        if(value !== undefined) this.setters[name]?.(value);
    }
}

/**
* An attribute setter is used to set attributes by name
*/
class AttributeSetter extends ShaderSetter {
    constructor(context, program) {
        super();

        const gl = context;
        
        for (let i = 0, l = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES); i < l; i++) {
            const { name, type, size } = gl.getActiveAttrib(program, i);
            const location = gl.getAttribLocation(program, name);
            
            this.locations[name] = location;
            this.setters[name]   = createAttribSetter(gl, location, type, size);
        }
    }
}

/**
* A uniform setter is used to set uniforms by name
*/
class UniformSetter extends ShaderSetter {
    constructor(context, program) {
        super();

        const gl = context;
        
        const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);        
        const structs = {};
        
        for (let i = 0; i < uniformCount; i++) {
            const { type, name } = gl.getActiveUniform(program, i);
            
            const location = gl.getUniformLocation(program, name);
            if(location === null) continue; //uniform is buffer block
                    
            this.setters[name]   = createUniformSetter(gl, location, type);
            this.locations[name] = location;
            
            if(name.endsWith('[0]')){
                const subName = name.substring(0, name.length - 3);
                if(SIMPLE_VECTOR_TYPES.includes(type)) {
                    this.setters[subName] = this.setters[name];
                } else {
                    this.setters[subName] = createArrayUniformSetter(gl, location, type, subName, this.setters);
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
            this.setters[struct] = createStructUniformSetter(propSetters);
            
            if(struct.endsWith('[0]')) {
                const subName = struct.substring(0, struct.length - 3);
                this.setters[subName] = createArrayUniformSetter(gl, this.locations[subName], null, subName, this.setters);
            }
        }
    }
}

/**
* An sampler setter is used to set samplers by name
*/
class SamplerSetter extends ShaderSetter {
    constructor(context, program, bindings) {
        super();

        const gl = context;
        
        const maxUnits       = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS) - 1;
        const boundUnits     = Object.values(bindings).map(({ unit }) => unit);
        const availableUnits = [...new Array(maxUnits)].map((_,i) => i).filter(v => boundUnits.indexOf(v) === -1);

        const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);

        for (let i = 0; i < uniformCount; i++) {
            const { type, name } = gl.getActiveUniform(program, i);
            if(SAMPLER_TARGETS[type]) {
                const { unit, target } = bindings[name] || { unit: availableUnits.shift(), target: SAMPLER_TARGETS[type] };

                this.locations[name] = unit;
                this.setters[name]   = createSamplerSetter(gl, unit, target);
            }
        }
    }
}

class BlockSetter extends ShaderSetter {
    constructor(context, program, bindings) {
        super();
        
        const gl = context;

        const maxUnits       = gl.getParameter(gl.MAX_UNIFORM_BUFFER_BINDINGS);
        const boundUnits     = Object.values(bindings);
        const availableUnits = [...new Array(maxUnits)].map((_,i) => i).filter(v => boundUnits.indexOf(v) === -1); 
        
        const blockCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORM_BLOCKS);
        
        for (let i = 0; i < blockCount; i++) {
            const name = gl.getActiveUniformBlockName(program, i);

            const unit = bindings[name] !== undefined ? bindings[name] : availableUnits.shift();

            this.locations[name] = unit;
            this.setters[name]   = createBlockSetter(gl, unit, program);
        }
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
    
    static samplerBindings = {};
    static uniformBindings = {};
    
    /**
    * Creates an instance of Program.
    * @param {WebGLRenderingContext} context - The WebGL context to create the shader with.
    * @param {Object} [defines={}] - An object of key value pairs to add as #define key value in shaders.
    */
    constructor(context, { defines = {}, settings } = {}) {
        const { vertexShaderSrc, fragmentShaderSrc } = this.constructor;
        
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
        * An setter for setting attribute values. Is null until program is compiled.
        * @type {AttributeMap}
        */
        this.attributes = null;
        
        /**
        * A setter for setting uniform values. Is null until program is compiled.
        * @type {UniformSetter}
        */
        this.uniforms = null;
        
        /**
        * A setter for setting sampler textures. Is null until program is compiled.
        * @type {SamplerSetter}
        */
        this.samplers = null;
        
        /**
        * A setter for setting uniform block bindings. Is null until program is compiled.
        * @type {BlockSetter}
        */
        this.blocks = null;
        
        /**
        * An object of key value pairs added #define key value in shaders.
        * @type {Object}
        */
        this.defines = defines;
        
        /**
        * The WebGL program. Is null until program is compiled.
        * @type {WebGLProgram}
        */
        this.program = null;
        
        this.settings = settings;
    }
    
    define(defines) {
        return Object.fromEntries(Object.entries(defines).filter(([,val]) => val !== null));
    }
    
    async compile({ sync = false } = {}, abortCtl){
        const { context: gl, defines, vertexShaderSrc, fragmentShaderSrc } = this;
        
        const defineStr = Object.entries(this.define(defines)).map(([key, val]) => `#define ${key} ${val}`).join('\n');
        const cacheKey  = this.constructor.name + vertexShaderSrc + fragmentShaderSrc + defineStr;
        
        const cache = contextCache.get(gl) || contextCache.set(gl, new Map()).get(gl);
        let compiled =  cache.get(cacheKey);
        if(!compiled) {
            const vertexShader   = createShader(gl, gl.VERTEX_SHADER, `#version 300 es\n${defineStr}\n${vertexShaderSrc}`);
            const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, `#version 300 es\n${defineStr}\n${fragmentShaderSrc}`);
            const program        = createProgram(gl, vertexShader, fragmentShader);
            
            const ext = gl.getExtension('KHR_parallel_shader_compile');
            
            if (ext && !sync) {
                do {
                    await new Promise(resolve => setTimeout(resolve));
                    if(abortCtl?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
                } while(!gl.getProgramParameter(program, ext.COMPLETION_STATUS_KHR))
            }
            
            checkShaderStatus(gl, vertexShader);
            checkShaderStatus(gl, fragmentShader);
            checkProgramStatus(gl, program);
            
            const attributes = new AttributeSetter(gl, program);
            const uniforms   = new UniformSetter(gl, program);
            const samplers   = new SamplerSetter(gl, program, this.constructor.samplerBindings);
            const blocks     = new BlockSetter(gl, program, this.constructor.uniformBindings);
            
            gl.useProgram(program);
            
            // If WebGL ever supports bindings (i.e. `layout(binding=0)`) these can probably be removed
            for(const [name, location] of Object.entries(samplers.locations)) {
                uniforms.set(name, location);
            }
            
            // If WebGL ever supports bindings (i.e. `layout(binding=0)`) these can probably be removed
            for(const [name, location] of Object.entries(blocks.locations)){
                blocks.set(name, location);
            }
            
            compiled = {
                vertexShader,
                fragmentShader,
                program,
                attributes,
                uniforms,
                samplers,
                blocks,
            };
            cache.set(cacheKey, compiled);
        } 
        
        Object.assign(this, compiled);
    }
    
    use() {
        if(!this.program) this.compile({ sync: true });
        this.context.useProgram(this.program);
    }
    
    run() {
        this.use();
    }
    
    static clearCache(context) {
        contextCache.get(context)?.clear();
    }

    static setCommonSampler(context, name, texture) {
        const binding = this.samplerBindings[name];
        if(binding) {
            const { unit, target = GL.TEXTURE_2D } = binding;
            context.activeTexture(context.TEXTURE0 + unit);
            context.bindTexture(target, texture);
        }
    }
}

export default Program;
