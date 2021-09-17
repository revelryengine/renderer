const glsl = String.raw; // For syntax-highlighting

const GL = WebGL2RenderingContext;

/** 
 * @see https://www.khronos.org/registry/OpenGL/extensions/ARB/ARB_uniform_buffer_object.txt
 * @see https://learnopengl.com/Advanced-OpenGL/Advanced-GLSL
 * */

const TYPES = {
    [GL.FLOAT]:      { declaration: 'float', alignment:  4, bytes:  4, TypedArray: Float32Array },
    [GL.INT]:        { declaration: 'int',   alignment:  4, bytes:  4, TypedArray: Int32Array   },
    [GL.BOOL]:       { declaration: 'bool',  alignment:  4, bytes:  4, TypedArray: Int32Array   },
    [GL.FLOAT_VEC2]: { declaration: 'vec2',  alignment:  8, bytes:  8, TypedArray: Float32Array },
    [GL.FLOAT_VEC3]: { declaration: 'vec3',  alignment: 16, bytes: 12, TypedArray: Float32Array },
    [GL.FLOAT_VEC4]: { declaration: 'vec4',  alignment: 16, bytes: 16, TypedArray: Float32Array },
    [GL.INT_VEC2]:   { declaration: 'ivec2', alignment:  8, bytes:  8, TypedArray: Int32Array   },
    [GL.INT_VEC3]:   { declaration: 'ivec2', alignment: 16, bytes: 12, TypedArray: Int32Array   },
    [GL.INT_VEC4]:   { declaration: 'ivec2', alignment: 16, bytes: 16, TypedArray: Int32Array   },
    [GL.BOOL_VEC2]:  { declaration: 'bvec2', alignment:  8, bytes:  8, TypedArray: Int32Array   },
    [GL.BOOL_VEC3]:  { declaration: 'bvec3', alignment: 16, bytes: 12, TypedArray: Int32Array   },
    [GL.BOOL_VEC4]:  { declaration: 'bvec4', alignment: 16, bytes: 16, TypedArray: Int32Array   },
    [GL.FLOAT_MAT2]: { declaration: 'mat2',  alignment: 16, bytes: 32, TypedArray: Float32Array },
    [GL.FLOAT_MAT3]: { declaration: 'mat3',  alignment: 16, bytes: 48, TypedArray: Float32Array },
    [GL.FLOAT_MAT4]: { declaration: 'mat4',  alignment: 16, bytes: 64, TypedArray: Float32Array },
    [GL.INT_MAT2]:   { declaration: 'imat2', alignment: 16, bytes: 32, TypedArray: Int32Array   },
    [GL.INT_MAT3]:   { declaration: 'imat3', alignment: 16, bytes: 48, TypedArray: Int32Array   },
    [GL.INT_MAT4]:   { declaration: 'imat4', alignment: 16, bytes: 64, TypedArray: Int32Array   },
    [GL.BOOL_MAT2]:  { declaration: 'bmat2', alignment: 16, bytes: 32, TypedArray: Int32Array   },
    [GL.BOOL_MAT3]:  { declaration: 'bmat3', alignment: 16, bytes: 48, TypedArray: Int32Array   },
    [GL.BOOL_MAT4]:  { declaration: 'bmat4', alignment: 16, bytes: 64, TypedArray: Int32Array   },
}

function nextMultiple(v, m) {
    return Math.ceil(v / m) * m;
}

export class UBO {
    static location = 0;

    constructor(context) {
        this.context  = context;

        const gl = context;

        this.arrayBuffer = new ArrayBuffer(this.constructor.getByteSize());

        this.glBuffer = gl.createBuffer();
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.glBuffer);
        gl.bufferData(gl.UNIFORM_BUFFER, new DataView(this.arrayBuffer), gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.UNIFORM_BUFFER, null);
        
        this.views = {};

        let offset = 0;
        for(const { name, type, size = 1 } of this.constructor.uniforms) {
            const { bytes, alignment, TypedArray } = TYPES[type];

            if(size > 1) {
                this.views[name] = [];
                const arrayAlignment = Math.max(TYPES[GL.FLOAT_VEC4].alignment, alignment);
                for(let i = 0; i < size; i++) {
                    offset = nextMultiple(offset, arrayAlignment);
                    this.views[name].push(new TypedArray(this.arrayBuffer, offset, bytes / TypedArray.BYTES_PER_ELEMENT));
                    offset += bytes;
                    
                }
            } else {
                offset = nextMultiple(offset, alignment);
                this.views[name] = new TypedArray(this.arrayBuffer, offset, bytes / TypedArray.BYTES_PER_ELEMENT);
                offset += bytes;
                
            }
        }
    }

    bind(location = this.constructor.location) {
        const { context: gl } = this;
        gl.bindBufferBase(gl.UNIFORM_BUFFER, location, this.glBuffer);
    }

    bindRange(){
        
    }

    upload() {
        const { context: gl } = this;
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.glBuffer);
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.arrayBuffer);
        gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    }

    static uniforms = [];
    static getShaderSource() {
        const { uniforms } = this;
        const uniformDeclaration = ({ type, name, size = 1 }) => `    ${TYPES[type].declaration} ${name}${size > 1 ? `[${size}]`: ''};`;

        return glsl`
layout(std140) uniform ${this.name} {
${uniforms.map(uniformDeclaration).join(`\n`)}
};`
    }

    static getByteSize() {
        return this.uniforms.reduce((offset, { type, size = 1 }) => {
            const { bytes, alignment } = TYPES[type];
            if(size > 1) {
                const arrayAlignment = Math.max(TYPES[GL.FLOAT_VEC4].alignment, alignment);
                for(let i = 0; i < size; i++) {
                    offset = nextMultiple(offset, arrayAlignment) + bytes;
                }
            } else {
                offset = nextMultiple(offset, alignment) + bytes;
            }
            
            return offset;
        }, 0);
    }
}

export default UBO;