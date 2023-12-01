/// <reference path="./render-node.d.ts" />

import { DEFAULT_COLOR_PARAMS, DEFAULT_DEPTH_PARAMS, TEXTURE_USAGE } from '../constants.js';

export class RenderNode {
    attachments = {};
    connections = {};
    output      = {};
    size        = {};

    #width = 0;
    #height = 0;

    scaleFactor = 1;

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

    /**
     * @param {keyof this['connections']} name
     */
    getConnectionValue(name) {
        if(!this.connections[name]) return;
        const { src, output } = this.connections[name];
        return src.output[output];
    }

    getTargetSize(){
        return {
            width  : this.size.width  ?? (this.renderPath.width * this.scaleFactor),
            height : this.size.height ?? (this.renderPath.height * this.scaleFactor),
        }
    }

    hasEnabledAttachments() {
        const { colors, depth } = this.attachments;
        return (colors && Object.values(colors).some(c => (c.enabled ?? true)))  || (depth && (depth.enabled ?? true));
    }

    getHighestAttachmentLocation() {
        const { colors } = this.attachments;
        return colors ? Object.values(colors).filter(c => (c.enabled ?? true) && c.location !== undefined).reduce((accum, c) => Math.max(c.location, accum), -1) : -1;
    }

    initAttachments() {
        if(!this.hasEnabledAttachments()) return;

        const { width, height } = this.getTargetSize();

        if(width === this.#width && height === this.#height) return; //no resize needed

        const { gal } = this.renderPath;
        const { attachments: { colors = [], depth }, sampleCount = 1, layers = 1 } = this;
        const autoMipLevelCount = this.autoMipLevelCount ? (Math.floor(Math.log2(Math.min(width, height))) + 1) : undefined;

        const highestLocation =this.getHighestAttachmentLocation();

        const renderPassDescriptors = [];

        for(let i = 0; i < layers; i++) {
            renderPassDescriptors.push({
                label: `${this.constructor.name} (layer ${i})`,
                colorAttachments: new Array(highestLocation + 1).fill(null),
            });
        }

        for(const [name, color] of Object.entries(colors)) {
            color.texture?.destroy();
            color.unresolved?.destroy();

            const { format, mipLevelCount = autoMipLevelCount, clearValue, storeOp, loadOp, location, enabled } = { ...DEFAULT_COLOR_PARAMS, ...color };
            if(enabled) {
                const usage = TEXTURE_USAGE.RENDER_ATTACHMENT | TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_SRC;
                const label = `${this.constructor.name} ${name}`;
                const descriptor = { label, format, mipLevelCount, usage, size: { width, height, depthOrArrayLayers: layers } };

                color.texture    = gal.device.createTexture(descriptor);
                color.unresolved = (sampleCount > 1) ? gal.device.createTexture({ ...descriptor, label: `${label} (unresolved)`, sampleCount }) : undefined;

                if(location !== undefined) {
                    for(let i = 0; i < layers; i++) {
                        renderPassDescriptors[i].colorAttachments[location] = {
                            view: (color.unresolved ?? color.texture).createView({ mipLevelCount: 1, baseArrayLayer: i, arrayLayerCount: 1 }),
                            resolveTarget: color.unresolved && color.texture.createView({ mipLevelCount: 1, baseArrayLayer: i, arrayLayerCount: 1 }),
                            clearValue,
                            storeOp,
                            loadOp,
                        };
                    }
                }
            }
        }

        if(depth) {
            depth.texture?.destroy();
            depth.unresolved?.destroy();

            const { format, depthClearValue, depthStoreOp, depthLoadOp, enabled } = { ...DEFAULT_DEPTH_PARAMS, ...depth };
            if(enabled) {
                const usage = TEXTURE_USAGE.RENDER_ATTACHMENT | TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_SRC;
                const label = `${this.constructor.name} depth`;
                const descriptor = { label, format, usage, size: { width, height, depthOrArrayLayers: layers } };

                depth.texture    = gal.device.createTexture(descriptor);
                depth.unresolved = (sampleCount > 1) ? gal.device.createTexture({ ...descriptor, label: `${label} (unresolved)`, sampleCount }) : undefined;

                for(let i = 0; i < layers; i++) {
                    //glResolveTarget is WebGL2 only, WebGPU will need to resolve the depth texture after the render pass.
                    renderPassDescriptors[i].depthStencilAttachment = {
                        view: (depth.unresolved ?? depth.texture).createView({ mipLevelCount: 1, baseArrayLayer: i, arrayLayerCount: 1 }),
                        glResolveTarget: depth.unresolved && depth.texture.createView({ mipLevelCount: 1, baseArrayLayer: i, arrayLayerCount: 1 }),
                        depthClearValue,
                        depthStoreOp,
                        depthLoadOp,
                    }
                }
            }
        }

        this.renderPassDescriptors = renderPassDescriptors;
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
        this.depthTextureResolver = depth?.unresolved && this.gal.createDepthTextureResolver?.({ source: depth.unresolved, destination: depth.texture });
    }

    begin(commandEncoder, { layer = 0 } = {}) {
        return commandEncoder.beginRenderPass(this.renderPassDescriptors[layer]);
    }

    render() {

    }

    end(renderPassEncoder) {
        renderPassEncoder.end();
    }

    run(commandEncoder, ...args) {
        const renderPassEncoder = this.begin(commandEncoder, ...args);
        this.render(renderPassEncoder, ...args);
        this.end(renderPassEncoder, ...args);

        this.depthTextureResolver?.(commandEncoder);
    }

    destroy() {
        const { attachments: { colors = [], depth } } = this;
        for(const color of Object.values(colors)) {
            color.texture?.destroy();
            color.unresolved?.destroy();
        }

        if(depth) {
            depth.texture?.destroy();
            depth.unresolved?.destroy();
        }

        this.#width = 0;
        this.#height = 0;
    }

    /**
     * @param {import('../graph.js').Graph} graph
     */
    async precompile(graph) {

    }
}

/**
 * A CubeRenderNode is similar to a RenderNode but it creates all attachments as cubemaps and will run once for each cube face
 * Does not support depthStencil attachments
 */
export class CubeRenderNode extends RenderNode {
    #width;
    #height;

    initAttachments() {
        if(!this.hasEnabledAttachments()) return;

        const { gal } = this.renderPath;
        const { colors = [] } = this.attachments;
        const { width, height } = this.getTargetSize();

        if(width === this.#width && height === this.#height) return; //no resize needed

        this.renderPassDescriptors = [];
        for(const [name, color] of Object.entries(colors)) {
            color.texture?.destroy();

            const { format, mipLevelCount, enabled } = { ...DEFAULT_COLOR_PARAMS, ...color };

            if(enabled) {
                color.texture = gal.device.createTexture({
                    label: `${this.constructor.name} ${name}`,
                    size:  { width, height, depthOrArrayLayers: 6, ...this.size },
                    cubemap: true,
                    format,
                    mipLevelCount,
                    usage: TEXTURE_USAGE.RENDER_ATTACHMENT | TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_SRC,
                });
            }
        }

        const highestLocation =this.getHighestAttachmentLocation();

        for(let face = 0; face < 6; face++) {
            const renderPassDescriptor = {
                label: this.constructor.name,
                colorAttachments: new Array(highestLocation + 1).fill(null),
            }

            for(const color of Object.values(colors)) {
                const { texture, clearValue, location, enabled } = { ...DEFAULT_COLOR_PARAMS, ...color };
                if(enabled && location !== undefined) {
                    renderPassDescriptor.colorAttachments[location] = {
                        view: texture.createView({ dimension: '2d', baseArrayLayer: face, mipLevelCount: 1 }),
                        clearValue,
                        storeOp: 'store',
                        loadOp: 'clear',
                    };
                }
            }

            this.renderPassDescriptors[face] = renderPassDescriptor;
        }

        this.#width  = width;
        this.#height = height;
    }

    begin(commandEncoder, face) {
        return commandEncoder.beginRenderPass(this.renderPassDescriptors[face]);
    }

    end(renderPassEncoder) {
        renderPassEncoder.end();
    }

    run(commandEncoder, ...args) {
        for(let face = 0; face < 6; face++){
            const renderPassEncoder = this.begin(commandEncoder, face, ...args);
            this.render(renderPassEncoder, face, ...args);
            this.end(renderPassEncoder, face, ...args);
        }
    }
}
