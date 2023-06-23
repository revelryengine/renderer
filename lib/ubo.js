import { STD140_LAYOUT, BUFFER_USAGE } from './constants.js';
import { roundUp, merge } from './utils.js';

/**
 * Uniform Buffer Object
 */
export class UBO {
    constructor(gal, values) {
        this.gal    = gal;
        this.buffer = gal.device.createBuffer(this.constructor.layout);
        this.data   = new Uint8Array(this.constructor.layout.size);   
        this.layout.defineViewProperties(this, this.data.buffer);

        if(values) {
            const merged = merge({}, this.constructor.defaults ?? {}, values);
            Object.assign(this, merged);
            this.upload();
        }
    }

    get layout (){
        return this.constructor.layout;
    }

    get name() {
        return this.constructor.name;
    }

    get defaults() {
        return this.constructor.defaults;
    }

    static Layout = class STD140Layout {
        constructor(uniforms = []) {
            this.uniforms = [];
            this.structs  = [];

            let offset = 0;
            for(const { name, type, layout, count = 1 } of uniforms) {
                
                const output = { name, type, count };

                if(layout) {
                    const subLayout = new STD140Layout(layout);
                    output.size     = roundUp(16, subLayout.size);
                    output.align    = STD140_LAYOUT['vec4<f32>'].align;
                    output.layout   = subLayout;
                    output.glsl     = type;
                    this.structs.push(...subLayout.structs, { type, layout: subLayout });
                } else {
                    const { size, align, glsl, TypedArray } = STD140_LAYOUT[type];
                    output.size       = count > 1 ? roundUp(align, size) : size;
                    output.align      = count > 1 ? STD140_LAYOUT['vec4<f32>'].align : align;
                    output.glsl       = glsl;
                    output.TypedArray = TypedArray;
                }

                offset = roundUp(output.align, offset);
                output.offset = offset;

                offset += output.size;
                for(let i = 1; i < count; i++) {
                    offset += roundUp(output.align, output.size);
                }

                this.uniforms.push(output);
            }
            
            this.size  = roundUp(16, offset);
            this.usage = BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST;
        }

        #createViews(buffer, parentOffset = 0) {
            const views = {};

            const { uniforms } = this;
            for(const { name, offset, size, align, TypedArray, layout, count = 1 } of uniforms) {
                let currentOffset = parentOffset + offset;

                if(count > 1) {
                    views[name] = [];
                    for(let i = 0; i < count; i++) {
                        if(layout) {
                            views[name].push(layout.#createViews(buffer, currentOffset));
                        } else {
                            views[name].push(new TypedArray(buffer, currentOffset, size / TypedArray.BYTES_PER_ELEMENT));
                        }
                        currentOffset = roundUp(align, currentOffset + size);
                    }
                } else {
                    if(layout) {
                        views[name] = layout.#createViews(buffer, currentOffset);
                    } else {
                        views[name] = new TypedArray(buffer, currentOffset, size / TypedArray.BYTES_PER_ELEMENT);
                    }
                }
            }

            return views;
        }

        #defineViewProperties(object, views) {
            for(const [name, view] of Object.entries(views)) {
                if(Array.isArray(view)) {
                    const subViews = view.map(view => {
                        if(ArrayBuffer.isView(view)) return view;
                        return this.#defineViewProperties({}, view);
                    });
                    Object.defineProperty(object, name, {
                        get () { return subViews; },
                        set(v) {
                            if(v === undefined) return;
                            const l = Math.min(v.length, subViews.length);
                            for(let i = 0; i < l; i++) {
                                if(ArrayBuffer.isView(subViews[i])){
                                    const view = subViews[i];

                                    if(view.BYTES_PER_ELEMENT === view.byteLength) {
                                        view[0] = v[i]; //scalar set
                                    } else {
                                        view.set(v[i].slice(0, view.length), 0);
                                    }   
                                    
                                } else {
                                    Object.assign(subViews[i], v[i]);
                                }
                                
                            }
                        }
                    })
                } else if(ArrayBuffer.isView(view)) {
                    Object.defineProperty(object, name, {
                        get() { 
                            if(view.BYTES_PER_ELEMENT === view.byteLength) {
                                return view[0]; 
                            }
                            return view; 
                        },
                        set(v) {
                            if(v === undefined) return;
                            if(view.BYTES_PER_ELEMENT === view.byteLength) {
                                view[0] = v; //scalar set
                            } else {
                                view.set(v.slice(0, view.length), 0);
                            }
                        }
                    })
                } else { // must be object
                    const subview = this.#defineViewProperties({}, view);
                    Object.defineProperty(object, name, {
                        get () { return subview; },
                        set(v) {
                            if(v === undefined) return;
                            for(const prop in v) {
                                subview[prop] = v[prop];
                            }
                        }
                    })
                }
            }
            return object;
        }

        defineViewProperties(object, buffer) {
            const views = this.#createViews(buffer);
            this.#defineViewProperties(object, views);
        }
    }

    upload() {
        this.gal.device.queue.writeBuffer(this.buffer, 0, this.data);
        return this.buffer;
    }

    /**
     * Retruns a mat3x3 aligned to support std140 layout.
     */
    static std140Mat3(mat){
        return new Float32Array([
            mat[0], mat[1], mat[2], 0,
            mat[3], mat[4], mat[5], 0,
            mat[6], mat[7], mat[8], 0,
        ]);
    }
} 

export default UBO;