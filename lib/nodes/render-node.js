import { DEFAULT_COLOR_PARAMS, DEFAULT_DEPTH_PARAMS, TEXTURE_USAGE } from '../constants.js';

export class RenderNode {
    attachments = {};
    connections = {};
    output      = {};
    size        = {};

    #width;
    #height;

    scaleFactor = 1;

    constructor(renderer) {
        this.renderer = renderer;
        this.gal        = renderer.gal;
    }

    getConnectionValue(name) {
        if(!this.connections[name]) return;
        const { src, output } = this.connections[name];
        return src.output[output];
    }

    getTargetSize(){
        return { 
            width  : this.size.width  || (this.renderer.width * this.scaleFactor),
            height : this.size.height || (this.renderer.height * this.scaleFactor),
        }
    }

    initAttachments() {
        if(!this.attachments.colors?.length && !this.attachments.depth) return;

        const { width, height } = this.getTargetSize();

        if(width === this.#width && height === this.#height) return; //no resize needed

        const { gal } = this.renderer;
        const { attachments: { colors = [], depth }, sampleCount = 1, layers = 1 } = this;

        const renderPassDescriptors = [];

        for(let i = 0; i < layers; i++) {
            renderPassDescriptors.push({
                label: `${this.constructor.name} (layer ${i})`,
                colorAttachments: [],
            });
        }

        const autoMipLevelCount = this.autoMipLevelCount ? (Math.floor(Math.log2(Math.min(width, height))) + 1) : undefined;

        for(const color of colors) {
            color.texture?.destroy();
            color.unresolved?.destroy();

            const { format, mipLevelCount = autoMipLevelCount, clearValue, storeOp, loadOp } = { ...DEFAULT_COLOR_PARAMS, ...color };

            const usage = TEXTURE_USAGE.RENDER_ATTACHMENT | TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_SRC;
            const label = `${this.constructor.name} ${color.name}`;
            const descriptor = { label, format, mipLevelCount, usage, size: { width, height, depthOrArrayLayers: layers } };

            color.texture    = gal.device.createTexture(descriptor);
            color.unresolved = (sampleCount > 1) ? gal.device.createTexture({ ...descriptor, label: `${label} (unresolved)`, sampleCount }) : undefined;

            for(let i = 0; i < layers; i++) {
                renderPassDescriptors[i].colorAttachments.push({
                    view: (color.unresolved || color.texture).createView({ mipLevelCount: 1, baseArrayLayer: i, arrayLayerCount: 1 }),
                    resolveTarget: color.unresolved && color.texture.createView({ mipLevelCount: 1, baseArrayLayer: i, arrayLayerCount: 1 }),
                    clearValue,
                    storeOp,
                    loadOp,
                });
            }
            
        }

        if(depth) {
            depth.texture?.destroy();
            depth.unresolved?.destroy();

            const { format, depthClearValue, depthStoreOp, depthLoadOp } = { ...DEFAULT_DEPTH_PARAMS, ...depth };

            const usage = TEXTURE_USAGE.RENDER_ATTACHMENT | TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_SRC;
            const label = `${this.constructor.name} ${depth.name}`;
            const descriptor = { label, format, usage, size: { width, height, depthOrArrayLayers: layers } };

            depth.texture    = gal.device.createTexture(descriptor);
            depth.unresolved = (sampleCount > 1) ? gal.device.createTexture({ ...descriptor, label: `${label} (unresolved)`, sampleCount }) : undefined;

            for(let i = 0; i < layers; i++) {
                //glResolveTarget is WebGL2 only, WebGPU will need to resolve the depth texture after the render pass.
                renderPassDescriptors[i].depthStencilAttachment = {
                    view: (depth.unresolved || depth.texture).createView({ mipLevelCount: 1, baseArrayLayer: i, arrayLayerCount: 1 }),
                    glResolveTarget: depth.unresolved && depth.texture.createView({ mipLevelCount: 1, baseArrayLayer: i, arrayLayerCount: 1 }), 
                    depthClearValue,
                    depthStoreOp,
                    depthLoadOp,
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
        for(const color of colors) {
            this.output[color.name] = color;
        }
        if(depth) {
            this.output[depth.name] = depth;
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
        for(const color of colors) {
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
}

export default RenderNode;