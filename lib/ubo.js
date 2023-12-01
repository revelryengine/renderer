/// <reference path="./ubo.d.ts" />

import { STD140_LAYOUT, BUFFER_USAGE } from './constants.js';
import { roundUp } from '../deps/utils.js';

/**
 * @typedef {import('./ubo.d.ts').UBO} UBOClass
 * @typedef {import('./ubo.d.ts').UBOConstructor} UBOConstructor
 *
 * @typedef {import('./ubo.d.ts').STD140Layout} STD140LayoutClass
 * @typedef {import('./ubo.d.ts').STD140LayoutView} STD140LayoutViewClass
 * @typedef {import('./ubo.d.ts').STD140LayoutUniformDefinition} STD140LayoutUniformDefinition
 * @typedef {import('./ubo.d.ts').STD140LayoutStructDefinition} STD140LayoutStructDefinition
 * @typedef {import('./ubo.d.ts').STD140LayoutFieldType} STD140LayoutFieldType
 * @typedef {import('./ubo.d.ts').STD140TypedArray} STD140TypedArray
 * @typedef {import('./ubo.d.ts').STD140LayoutView} STD140LayoutView
 * @typedef {import('./ubo.d.ts').STD140LayoutValueSetter} STD140LayoutValueSetter
 * @typedef {import('./ubo.d.ts').STD140LayoutViewProp} STD140LayoutViewProp
 */

/**
 * @this {STD140LayoutView}
 * @param {STD140LayoutValueSetter} values
 */
function setViewValues(values) {
    // Typescript has trouble relating the two sets (prop/value) together so there is some extra casting here
    const descriptors = Object.getOwnPropertyDescriptors(this);

    for(const key in values) {
        const descriptor = descriptors[key];
        const value      = values[key];

        if(descriptor && !descriptor.writable && !descriptor.set) {
            if(ArrayBuffer.isView(descriptor.value)){
                descriptor.value.set(/** @type {ArrayLike<number>}*/(value))
            } else if(Array.isArray(descriptor.value)) {
                if(Array.isArray(value)) {
                    for(let i = 0, l = Math.min(value.length, descriptor.value.length); i < l; i++) {
                        if(ArrayBuffer.isView(descriptor.value[i])){
                            descriptor.value[i].set(/** @type {ArrayLike<number>}*/(value[i]))
                        } else {
                            /** @type {STD140LayoutView} */(descriptor.value[i]).set(/** @type {STD140LayoutValueSetter} */(value[i]));
                        }
                    }
                }
            } else {
                /** @type {STD140LayoutView} */(descriptor.value).set(/** @type {STD140LayoutValueSetter} */(value));
            }
        } else {
            this[key] = values[key];
        }
    }
}


/**
 * @implements {STD140LayoutClass}
 */
export class STD140Layout {
    /** @type {STD140LayoutUniformDefinition[]} */
    uniforms = [];

    /** @type {STD140LayoutStructDefinition[]} */
    structs = [];

    /**
     * @param {Record<string, STD140LayoutFieldType>} uniforms
     */
    constructor(uniforms = {}) {
        this.structs  = [];

        let offset = 0;
        for(const [name, entry] of Object.entries(uniforms)) {
            const { type, count = 1 } = entry;

            const output = /** @type {STD140LayoutUniformDefinition} */({ name, type, count });

            if('layout' in entry) {
                /** @type {STD140LayoutUniformDefinition & { layout: STD140Layout }}*/(output);

                const subLayout = new STD140Layout(entry.layout);
                output.size     = roundUp(16, subLayout.size);
                output.align    = STD140_LAYOUT['vec4<f32>'].align;
                output.layout   = subLayout;
                output.glsl     = type;
                this.structs.push(...subLayout.structs, { type, layout: subLayout });
            } else {
                entry
                type
                const { size, align, scalar, glsl, TypedArray } = STD140_LAYOUT[entry.type];
                output.size       = count > 1 ? roundUp(align, size) : size;
                output.align      = count > 1 ? STD140_LAYOUT['vec4<f32>'].align : align;
                output.scalar     = scalar;
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

    /**
     * @param {object} object
     * @param {ArrayBuffer} buffer
     * @param {number} [parentOffset]
     */
    createView(object, buffer, parentOffset = 0) {
        const views = /** @type {{ [key: string]: STD140LayoutViewProp }} */({});

        const { uniforms } = this;
        for(const uniform of uniforms) {
            const { name, offset, size, align, scalar, count = 1, layout, TypedArray } = uniform;

            let currentOffset = parentOffset + offset;

            if(count === 1) {
                if(layout) {
                    views[name] = { view: layout.createView({ set: setViewValues }, buffer, currentOffset) };
                } else if(TypedArray) {
                    const view = new TypedArray(buffer, currentOffset, size / TypedArray.BYTES_PER_ELEMENT);
                    if(scalar) {
                        views[name] = { view, scalar: true }
                    } else {
                        views[name] = { view };
                    }
                }
            } else {
                if(scalar && TypedArray) {
                    views[name] = { view: new TypedArray(buffer, currentOffset, count * size / TypedArray.BYTES_PER_ELEMENT) };
                } else {
                    const viewArray = /** @type {(STD140TypedArray[]|STD140LayoutView[])} */([]);
                    for(let i = 0; i < count; i++) {
                        if(layout) {
                            /** @type {(STD140LayoutView[])} */(viewArray).push(layout.createView({ set: setViewValues }, buffer, currentOffset));
                        } else if(TypedArray) {
                            /** @type {(STD140TypedArray[])} */(viewArray).push(new TypedArray(buffer, currentOffset, size / TypedArray.BYTES_PER_ELEMENT));
                        }
                        currentOffset = roundUp(align, currentOffset + size);
                    }
                    views[name] = { view: Object.freeze(viewArray) };
                }
            }
        }

        const view = object ?? { set: setViewValues };

        for(const name in views) {
            const prop = views[name];

            if(('scalar' in prop) && prop.scalar) {
                Object.defineProperty(view, name, { enumerable: true, get() { return prop.view[0] }, set(v) { prop.view[0] = v } });
            } else {
                Object.defineProperty(view, name, { enumerable: true, writable: false, value: prop.view });
            }
        }

        return /** @type {ReturnType<STD140LayoutClass['createView']>} */(view);
    }
}


/**
 * Uniform Buffer Object
 * @implements {UBOClass}
 */
export class UBO {
    /**
     * @param {import('./revgal.js').RevGAL} gal
     * @param {STD140LayoutValueSetter} [values]
     */
    constructor(gal, values) {
        this.gal    = gal;
        this.buffer = gal.device.createBuffer(this.layout);
        this.data   = new Uint8Array(this.layout.size);

        this.layout.createView(this, this.data.buffer);

        if(values) /** @type {UBO & STD140LayoutView} */(this).set(values);
    }

    set = setViewValues;

    get name() {
        return this.constructor.name;
    }

    get layout (){
        return /** @type {UBOConstructor} */(this.constructor).layout;
    }

    get defaults() {
        return /** @type {UBOConstructor} */(this.constructor).defaults;
    }

    upload() {
        this.gal.device.queue.writeBuffer(this.buffer, 0, this.data);
        return this.buffer;
    }

    /**
     * Retruns a mat3x3 aligned to support std140 layout.
     * @param {mat4} mat
     */
    static std140Mat3(mat){
        return new Float32Array([
            mat[0], mat[1], mat[2], 0,
            mat[3], mat[4], mat[5], 0,
            mat[6], mat[7], mat[8], 0,
        ]);
    }

    /**
     * @param {Record<string, STD140LayoutFieldType>} layout
     * @param {Record<string, unknown>} defaults
     */
    static Layout(layout, defaults) {
        return class extends UBO {
            static layout   = new STD140Layout(layout);
            static defaults = defaults;
        }
    }
}
