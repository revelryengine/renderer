import { UBO } from '../ubo.js';

export class RenderPathSettings {
    flags = /** @type {Record<String, unknown>} */({});

    /**
     * @param {import('../revgal.js').RevGAL} gal;
     */
    constructor(gal) {
        this.gal    = gal;
        this.values = new (UBO.Layout({}))(this.gal);
    }

    /**
     * @param {Partial<this['flags']>} [flags]
     * @param {Parameters<this['values']['set']>[0]} [values]
     */
    reconfigure(flags, values) {
        if(flags) Object.assign(this.flags, flags);
        if(values) this.values.set(values);
    }

    get buffer() {
        return this.values.buffer;
    }

    upload() {
        this.values.upload();
    }

    /**
     * @param {number|string} group
     * @param {number|string} binding
     */
    generateUniformBlock(group, binding) {
        return this.values.generateUniformBlock(group, binding, 'Settings');
    }
}
