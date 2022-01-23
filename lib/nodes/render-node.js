import { TEXTURE_USAGE } from '../constants.js';

export class RenderNode {
    attachments = {};
    connections = {};
    output      = {};
    size        = {};
    children    = [];

    #width;
    #height;

    static DEFAULT_COLOR_PARAMS = {
        format:    'rgba8unorm',
        storeOp:   'store',
        loadValue: [0, 0, 0, 0],
    }

    static DEFAULT_DEPTH_PARAMS = {
        format:           'depth24plus',
        depthLoadValue:   1,
        stencilLoadValue: 0,
        depthStoreOp:     'store',
        stencilStoreOp:   'store',
    }

    constructor(renderPath) {
        this.renderPath = renderPath;
        this.gal = renderPath.gal;
    }

    getConnectionValue(name) {
        const { src, output } = this.connections[name];
        return src.output[output];
    }

    getTargetSize(){
        return { 
            width  : this.size.width  || this.renderPath.width,
            height : this.size.height || this.renderPath.height,
        }
    }

    resize() {
        if(!this.attachments.colors?.length && !this.attachments.depth) return;

        const { gal } = this.renderPath;
        const { attachments: { colors = [], depth }, sampleCount = 1 } = this;
        const { width, height } = this.getTargetSize();

        if(width === this.#width && height === this.#height) return; //no resize needed

        const renderPassDescriptor = {
            label: `Node: ${this.constructor.name}`,
            colorAttachments: [],
        }

        for(const color of colors) {
            color.texture?.destroy();
            color.unresolved?.destroy();

            const { format, mipLevelCount, loadValue, depthOrArrayLayers = 1 } = { ...RenderNode.DEFAULT_COLOR_PARAMS, ...color };

            const usage = TEXTURE_USAGE.RENDER_ATTACHMENT | TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_SRC;
            const descriptor = { format, mipLevelCount, usage, size:  { width, height, depthOrArrayLayers } };

            color.texture = gal.device.createTexture(descriptor);

            if(sampleCount > 1) {
                color.unresolved = gal.device.createTexture({ ...descriptor, sampleCount });
            }

            renderPassDescriptor.colorAttachments.push({
                view: (color.unresolved || color.texture).createView({ mipLevelCount: 1 }),
                resolveTarget: color.unresolved && color.texture.createView({ mipLevelCount: 1 }),
                loadValue,
            });
        }

        if(depth) {
            depth.texture?.destroy();

            const { format, depthLoadValue, depthStoreOp, stencilLoadValue, stencilStoreOp } = { ...RenderNode.DEFAULT_DEPTH_PARAMS, ...depth };

            const usage = TEXTURE_USAGE.RENDER_ATTACHMENT | TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_SRC;
            const descriptor = { format, usage, size:  { width, height } };

            depth.texture = gal.device.createTexture(descriptor);

            if(sampleCount > 1) {
                depth.unresolved = gal.device.createTexture({ ...descriptor, sampleCount });
            }

            renderPassDescriptor.depthStencilAttachment = {
                view: (depth.unresolved || depth.texture).createView({ mipLevelCount: 1 }),
                resolveTarget: depth.unresolved && depth.texture.createView({ mipLevelCount: 1 }),
                depthLoadValue,
                depthStoreOp,
                stencilLoadValue,
                stencilStoreOp,
            }
        }

        this.renderPassDescriptor = renderPassDescriptor;
        this.#width  = width;
        this.#height = height;
    }

    reconfigure() {
        const { attachments: { colors = [], depth } } = this;
        for(const color of colors) {
            this.output[color.name] = color;
        }
        if(depth) {
            this.output[depth.name] = depth;
        }
    }

    begin(commandEncoder) {
        return commandEncoder.beginRenderPass(this.renderPassDescriptor);
    }

    render(renderPassEncoder) {
        //run programs
    }

    end(renderPassEncoder) {
        renderPassEncoder.endPass();
    }

    run(commandEncoder, ...args) {
        const renderPassEncoder = this.begin(commandEncoder, ...args);
        this.render(renderPassEncoder, ...args);
        this.end(renderPassEncoder, ...args);
    }

    * iterateBlocks(blocks, { opaque = true, transmissive = false, alpha = false } = {}) {
    if(opaque)       yield * blocks.opaque;
    if(transmissive) yield * blocks.transmissive;
    if(alpha)        yield * blocks.alpha;
}
}

export default RenderNode;