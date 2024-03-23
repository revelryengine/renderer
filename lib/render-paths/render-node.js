import { NonNull } from '../../deps/utils.js';
import { TEXTURE_USAGE } from '../constants.js';

class RenderAttachment {
    /**
     * @type {import('../revgal.js').REVTexture|null}
     */
    #texture = null;
    get texture() {
        return this.#texture;
    }

    /**
     * @type {import('../revgal.js').REVTexture|null}
     */
    #unresolved = null;
    get unresolved() {
        return this.#unresolved;
    }

    /**
     * @param {{
     *    enabled?:       boolean,
     *    format?:        GPUTextureFormat,
     *    mipLevelCount?: number,
     * }} [options]
     */
    constructor({ enabled = true, format = 'rgba8unorm', mipLevelCount = 1 } = {}) {
        this.enabled = enabled;

        /** @readonly */
        this.format = format;
        /** @readonly */
        this.mipLevelCount = mipLevelCount;
    }

    /**
     * @param {import('../revgal.js').RevGAL} gal
     * @param {{ label: string, size: GPUExtent3DDict, sampleCount?: number, glCubemap?: boolean }} options
     */
    init(gal, { label, size: { width, height = 1, depthOrArrayLayers = 1 }, sampleCount = 1, glCubemap = false }) {
        const usage         = TEXTURE_USAGE.RENDER_ATTACHMENT | TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_SRC;
        const descriptor    = { label, format: this.format, mipLevelCount: this.mipLevelCount, usage, size: { width, height, depthOrArrayLayers }, glCubemap };

        this.#texture    = gal.device.createTexture(descriptor);
        this.#unresolved = (sampleCount > 1) ? gal.device.createTexture({ ...descriptor, label: `${label} (unresolved)`, sampleCount, mipLevelCount: 1, glCubemap }) : null;

        this.#destroyed = false;
    }

    #destroyed = false;
    get detroyed() {
        return this.#destroyed;
    }

    destroy() {
        this.#texture?.destroy();
        this.#unresolved?.destroy();
        this.#destroyed = true;
    }
}

export class ColorAttachment extends RenderAttachment {
    /**
     * @param {{
     *    enabled?:       boolean,
     *    format?:        GPUTextureFormat,
     *    storeOp?:       GPUStoreOp,
     *    loadOp?:        GPULoadOp,
     *    clearValue?:    GPUColor,
     *    mipLevelCount?: number,
     * }} [options]
     */
    constructor({ enabled = true, format = 'rgba8unorm', mipLevelCount = 1, storeOp = 'store', loadOp = 'clear', clearValue = [0, 0, 0, 0] } = {}) {
        super({ enabled, format, mipLevelCount });

        /** @readonly */
        this.storeOp = storeOp;
        /** @readonly */
        this.loadOp = loadOp;
        /** @readonly */

        this.clearValue = clearValue;
    }
}

export class DepthAttachment extends RenderAttachment {
    /**
     * @param {{
     *    enabled?:         boolean,
     *    format?:          GPUTextureFormat & `depth${string}`,
     *    depthStoreOp?:    GPUStoreOp,
     *    depthLoadOp?:     GPULoadOp,
     *    depthClearValue?: number,
     * }} [options]
     */
    constructor({ enabled = true, format = 'depth24plus', depthStoreOp = 'store', depthLoadOp = 'clear', depthClearValue = 1 } = {}) {
        super({ enabled, format, mipLevelCount: 1 });

        /** @readonly */
        this.depthStoreOp = depthStoreOp;
        /** @readonly */
        this.depthLoadOp = depthLoadOp;

        this.depthClearValue = depthClearValue;
    }
}

/**
 * @typedef {import('./render-node.js').RenderNode<any>} RenderNodeClass
 */


/**
 * @implements {RenderNodeClass}
 */
export class RenderNode {
    attachments = /** @type {RenderNodeClass['attachments']} */({});
    connections = /** @type {RenderNodeClass['connections']} */({});

    input       = /** @type {RenderNodeClass['input']} */({});
    output      = /** @type {RenderNodeClass['output']} */({});
    size        = /** @type {RenderNodeClass['size']} */({});

    #width = 0;
    #height = 0;

    scaleFactor = 1;
    sampleCount = 1;
    layers      = 1;
    cubemap     = false;

    #currentLayer = 0;
    get currentLayer() {
        return this.#currentLayer;
    }

    /**
     * @param {import('./render-path.js').RenderPath} renderPath
     */
    constructor(renderPath) {
        this.renderPath = renderPath;
    }

    get gal() {
        return this.renderPath.gal;
    }

    get settings() {
        return this.renderPath.settings;
    }

    get passData() {
        return NonNull(this.renderPath.passData, 'RenderNode.passData only available during render');
    }

    /**
     * @type {import('../revgal.js').REVRenderPassDescriptor[]}
     */
    #renderPassDescriptorLayers = [];

    /**
     * @type {import('../revgal.js').REVRenderPassDescriptor}
     */
    get renderPassDescriptor() {
        return NonNull(this.#renderPassDescriptorLayers[this.#currentLayer], 'RenderNode.renderPassDescriptor only available after reconfigure');
    }

    getTargetSize(){
        return {
            width  : this.size.width  ?? (this.renderPath.width * this.scaleFactor),
            height : this.size.height ?? (this.renderPath.height * this.scaleFactor),
        }
    }

    #hasEnabledAttachments() {
        const { colors, depth } = this.attachments;
        return (colors && Object.values(colors).some(c => (c.enabled ?? true)))  || (depth && (depth.enabled ?? true));
    }

    initAttachments() {
        if(!this.#hasEnabledAttachments()) return;

        const { width, height } = this.getTargetSize();

        if(width === this.#width && height === this.#height) return; //no resize needed

        const { gal } = this.renderPath;
        const { attachments: { colors = {}, depth }, sampleCount, layers, cubemap } = this;

        for(const [name, color] of Object.entries(colors)) {
            color.destroy();
            if(color.enabled) {
                color.init(gal, { label: `${this.constructor.name} ${name}`, size: { width, height, depthOrArrayLayers: layers }, sampleCount, glCubemap: cubemap });
            }
        }

        if(depth) {
            depth.destroy();
            if(depth.enabled) {
                depth.init(gal, { label: `${this.constructor.name} depth`, size: { width, height, depthOrArrayLayers: layers }, sampleCount, glCubemap: cubemap });
            }
        }

        this.#renderPassDescriptorLayers.length = 0;
        for(let i = 0; i < layers; i++) {
            this.#renderPassDescriptorLayers.push({
                label: `${this.constructor.name} (layer ${i})`,
                colorAttachments: Object.values(colors).map((color) => {
                    if(!color.enabled) return null;

                    return {
                        view:          NonNull(color.unresolved ?? color.texture).createView({ baseArrayLayer: i, mipLevelCount: 1, arrayLayerCount: 1 }),
                        resolveTarget: (color.unresolved ?? undefined) && NonNull(color.texture).createView({ dimension: '2d', baseArrayLayer: i, mipLevelCount: 1, arrayLayerCount: 1 }),
                        clearValue:    color.clearValue,
                        storeOp:       color.storeOp,
                        loadOp:        color.loadOp,
                    }
                }),
                depthStencilAttachment: depth && {
                    view:            NonNull(depth.unresolved ?? depth.texture).createView({ baseArrayLayer: i, mipLevelCount: 1, arrayLayerCount: 1 }),
                    glResolveTarget: (depth.unresolved ?? undefined) && NonNull(depth.texture).createView({ dimension: '2d', baseArrayLayer: i, mipLevelCount: 1, arrayLayerCount: 1 }),
                    depthClearValue: depth.depthClearValue,
                    depthStoreOp:    depth.depthStoreOp,
                    depthLoadOp:     depth.depthLoadOp,
                }
            });
        }

        this.#currentLayer = 0;
        this.#width  = width;
        this.#height = height;
    }

    reconfigure() {
        this.initAttachments();

        const { attachments: { colors = [], depth } } = this;
        for(const [name, color] of Object.entries(colors)) {
            this.output[name] = color;
        }
        if(depth) {
            this.output.depth = depth;
        }

        //For WebGPU use Only
        if(this.gal.api === 'webgpu' && depth?.unresolved) {
            this.depthTextureResolver = this.gal.createDepthTextureResolver?.(depth);
        }
    }

    /**
     * @param {Parameters<RenderNodeClass['begin']>[0]} commandEncoder
     */
    begin(commandEncoder) {
        return commandEncoder.beginRenderPass(this.renderPassDescriptor);
    }

    /**
     * @param {Parameters<RenderNodeClass['render']>[0]} renderPassEncoder
     */
    render(renderPassEncoder) {

    }

    /**
     * @param {Parameters<RenderNodeClass['end']>[0]} renderPassEncoder
     */
    end(renderPassEncoder) {
        renderPassEncoder.end();
    }

    /**
     * @param {Parameters<RenderNodeClass['run']>[0]} commandEncoder
     */
    run(commandEncoder) {
        const renderPassEncoder = this.begin(commandEncoder);
        this.render(renderPassEncoder);
        this.end(renderPassEncoder);

        this.depthTextureResolver?.(commandEncoder);
    }

    setRenderLayer(layer = 0) {
        if(layer >= this.#renderPassDescriptorLayers.length) throw new Error(`Layer ${layer} is out of bounds for ${this.constructor.name}`);

        this.#currentLayer = layer;
    }

    #destroyed = false;
    get destroyed() {
        return this.#destroyed;
    }

    destroy() {
        const { attachments: { colors = {}, depth } } = this;
        for(const color of Object.values(colors)) {
            color.destroy();
        }

        if(depth) {
            depth.destroy();
        }

        this.#width = 0;
        this.#height = 0;
        this.#destroyed = true;
    }

    /**
     * @param {import('../graph.js').Graph} graph
     */
    async precompile(graph) {

    }

    /**
     * Enables the specified attachments and disables all others
     * @param {...string} enabled
     */
    enableAttachments(...enabled) {
        const { colors = {}, depth } = this.attachments;
        for(const [name, color] of Object.entries(colors)) {
            color.enabled = enabled.includes(name);
        }

        if(depth) {
            depth.enabled = enabled.includes('depth');
        }
    }
}

/**
 * A CubeRenderNode is similar to a RenderNode but it creates all attachments as cubemaps and will run once for each cube face
 */
export class CubeRenderNode extends RenderNode {
    layers = 6;
    cubemap = true;

    /**
     * @param {Parameters<RenderNodeClass['run']>[0]} commandEncoder
     */
    run(commandEncoder) {
        for(let face = 0; face < 6; face++){
            this.setRenderLayer(face);
            const renderPassEncoder = this.begin(commandEncoder);
            this.render(renderPassEncoder);
            this.end(renderPassEncoder);
        }
    }
}
