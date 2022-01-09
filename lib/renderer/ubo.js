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
}

function nextMultiple(v, m) {
    return Math.ceil(v / m) * m;
}

export class UBO {
    static location = 0;

    static autoview = true;

    constructor(context) {
        this.context  = context;

        const gl = context;

        if(this.constructor.autoview) {
            const { layout } = this.constructor;

            this.arrayBuffer = new ArrayBuffer(nextMultiple(layout.bytes, 16));

            this.glBuffer = gl.createBuffer();
            gl.bindBuffer(gl.UNIFORM_BUFFER, this.glBuffer);
            gl.bufferData(gl.UNIFORM_BUFFER, new DataView(this.arrayBuffer), gl.DYNAMIC_DRAW);
            gl.bindBuffer(gl.UNIFORM_BUFFER, null);
            
            this.views = layout.createViews(this.arrayBuffer);
        }
    }

    bind(location = this.constructor.location) {
        const { context: gl } = this;
        gl.bindBufferBase(gl.UNIFORM_BUFFER, location, this.glBuffer);

        return this;
    }

    upload() {
        const { context: gl } = this;
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.glBuffer);
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.arrayBuffer);
        gl.bindBuffer(gl.UNIFORM_BUFFER, null);
        return this;
    }

    set(uniforms, views = this.views) {
        for(const [name, value] of Object.entries(uniforms)) {
            const view = views[name];
            this.setViewValue(view, value);
        }
    }

    setViewValue(view, value) {
        if(view !== undefined && value !== undefined) {
            if(ArrayBuffer.isView(view)) {
                if(view.length === 1) {
                    view.set([value]);
                } else if(value.byteLength > view.byteLength) {
                    view.set(value.subarray(0, view.byteLength / value.BYTES_PER_ELEMENT));
                } else {
                    view.set(value);
                }
            } else if(view instanceof Array) {
                for(let i = 0; i < value.length; i++) {
                    this.setViewValue(view[i], value[i]);
                }
                // if(ArrayBuffer.isView(view[0])){
                //     for(let i = 0; i < view.length; i++) {
                //         if(view.length === 1) {
                //             view.set([value]);
                //         } else if(value.byteLength > view.byteLength) {
                //             view[i].set(value[i].subarray(0, view[i].byteLength / value[i].BYTES_PER_ELEMENT));
                //         } else {
                //             view[i].set(value[i]);
                //         }
                //     }
                // } else {
                //     for(let i = 0; i < view.length; i++) {
                //         this.set(value[i], view[i]);
                //     }
                // }
            } else if(view instanceof Object) {
                this.set(value, view);
            } 
        }
    }
    

    setx(uniform, value) {
        if(value !== undefined) this.views[uniform]?.set([value]);
        return this;
    }

    setv(uniform, value) {
        if(value !== undefined && this.views[uniform] !== undefined) {
            if(value.byteLength > this.views[uniform].byteLength) value = value.subarray(0, this.views[uniform].byteLength / value.BYTES_PER_ELEMENT);
            this.views[uniform]?.set(value);
        }
    }

    static uniforms = [];
    static getShaderSource() {
        
        const uniformDeclaration = ({ declaration, name, size = 1 }) => `   ${declaration} ${name}${size > 1 ? `[${size}]`: ''};`;
        const structDelcaration  = ({ struct, layout: { uniforms } }) => `struct ${struct} {\n${uniforms.map(uniformDeclaration).join(`\n`)}\n};`;

        const structs = [];

        const search = [this.layout];
        while(search.length) {
            const layout = search.pop();
            for(const uniform of layout.uniforms){
                if(uniform.layout) {
                    structs.push(uniform);
                    search.unshift(uniform.layout);
                }
            }
        }

        return glsl`
${structs.map(structDelcaration).join('\n')}

layout(std140) uniform ${this.name} {
${this.layout.uniforms.map(uniformDeclaration).join(`\n`)}
};`
    }

    // static getByteSize() {
    //     return this.uniforms.reduce((offset, { type, size = 1 }) => {
    //         const { bytes, alignment } = TYPES[type];
    //         if(size > 1) {
    //             const arrayAlignment = TYPES[GL.FLOAT_VEC4].alignment;
    //             for(let i = 0; i < size; i++) {
    //                 offset = nextMultiple(offset, arrayAlignment) + bytes;
    //             }
    //         } else {
    //             offset = nextMultiple(offset, alignment) + bytes;
    //         }
            
    //         return offset;
    //     }, 0);
    // }

    static nextMultiple(v, m) {
        return Math.ceil(v / m) * m;
    }

    static TYPES = TYPES;

    static Layout = class Layout {
        constructor(uniforms) {
            this.uniforms = [];

            let offset = 0;
            for(const { name, type, struct, layout, size = 1 } of uniforms) {
                
                const output = { name, type, struct, size };

                if(struct) {
                    const subLayout    = new Layout(layout);
                    output.bytes       = nextMultiple(subLayout.bytes, 16);
                    output.alignment   = TYPES[GL.FLOAT_VEC4].alignment;
                    output.layout      = subLayout;
                    output.declaration = struct;
                } else {
                    const { bytes, alignment, declaration, TypedArray } = TYPES[type];
                    output.bytes       = bytes;
                    output.alignment   = size > 1 ? TYPES[GL.FLOAT_VEC4].alignment : alignment;
                    output.declaration = declaration;
                    output.TypedArray  = TypedArray;
                }

                offset = nextMultiple(offset, output.alignment);
                output.offset = offset;

                offset += output.bytes;
                for(let i = 1; i < size; i++) {
                    offset += nextMultiple(output.bytes, output.alignment);
                }

                this.uniforms.push(output);
            }
            this.bytes = offset;
        }

        createViews(buffer, parentOffset = 0) {
            const views = {};

            const { uniforms } = this;
            for(const { name, offset, bytes, alignment, TypedArray, struct, layout, size = 1 } of uniforms) {
                let currentOffset = parentOffset + offset;

                if(size > 1) {
                    views[name] = [];
                    for(let i = 0; i < size; i++) {
                        if(struct) {
                            views[name].push(layout.createViews(buffer, currentOffset));
                        } else {
                            views[name].push(new TypedArray(buffer, currentOffset, bytes / TypedArray.BYTES_PER_ELEMENT));
                        }
                        currentOffset = nextMultiple(currentOffset + bytes, alignment);
                    }
                } else {
                    if(struct) {
                        views[name] = layout.createViews(buffer, currentOffset);
                    } else {
                        views[name] = new TypedArray(buffer, currentOffset, bytes / TypedArray.BYTES_PER_ELEMENT);
                    }
                }
            }

            return views;
        }
    }
}

export default UBO;