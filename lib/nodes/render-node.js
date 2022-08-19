import { TEXTURE_USAGE } from '../constants.js';

export class RenderNode {
    attachments = {};
    connections = {};
    output      = {};
    size        = {};

    #width;
    #height;

    scaleFactor = 1;

    static DEFAULT_COLOR_PARAMS = {
        format     : 'rgba8unorm',
        storeOp    : 'store',
        loadOp     : 'clear',
        clearValue : [0, 0, 0, 0],
    }

    static DEFAULT_DEPTH_PARAMS = {
        format            : 'depth24plus',
        depthClearValue   : 1,
        depthStoreOp      : 'store',
        depthLoadOp       : 'clear',
    }

    constructor(renderPath) {
        this.renderPath = renderPath;
        this.gal        = renderPath.gal;
    }

    getConnectionValue(name) {
        if(!this.connections[name]) return;
        const { src, output } = this.connections[name];
        return src.output[output];
    }

    getTargetSize(){
        return { 
            width  : this.size.width  || (this.renderPath.width * this.scaleFactor),
            height : this.size.height || (this.renderPath.height * this.scaleFactor),
        }
    }

    resize() {
        if(!this.attachments.colors?.length && !this.attachments.depth) return;

        const { gal } = this.renderPath;
        const { attachments: { colors = [], depth }, sampleCount = 1, layers = 1 } = this;
        const { width, height } = this.getTargetSize();

        if(width === this.#width && height === this.#height) return; //no resize needed

        const renderPassDescriptors = [];

        for(let i = 0; i < layers; i++) {
            renderPassDescriptors.push({
                label: `Node: ${this.constructor.name} (Layer${i})`,
                colorAttachments: [],
            });
        }

        for(const color of colors) {
            color.texture?.destroy();
            color.unresolved?.destroy();

            const { format, mipLevelCount, clearValue, storeOp, loadOp } = { ...RenderNode.DEFAULT_COLOR_PARAMS, ...color };

            const usage = TEXTURE_USAGE.RENDER_ATTACHMENT | TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_SRC;
            const descriptor = { format, mipLevelCount, usage, size: { width, height, depthOrArrayLayers: layers } };

            color.texture = gal.device.createTexture(descriptor);

            if(sampleCount > 1) {
                color.unresolved = gal.device.createTexture({ ...descriptor, sampleCount });
            }

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

            const { format, depthClearValue, depthStoreOp, depthLoadOp } = { ...RenderNode.DEFAULT_DEPTH_PARAMS, ...depth };

            const usage = TEXTURE_USAGE.RENDER_ATTACHMENT | TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_SRC;
            const descriptor = { format, usage, size: { width, height, depthOrArrayLayers: layers } };

            depth.texture = gal.device.createTexture(descriptor);

            if(sampleCount > 1) {
                depth.unresolved = gal.device.createTexture({ ...descriptor, sampleCount });
            }

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
        if(!this.#width || !this.#height) this.resize();

        const { attachments: { colors = [], depth } } = this;
        for(const color of colors) {
            this.output[color.name] = color;
        }
        if(depth) {
            this.output[depth.name] = depth;
        }

        if(this.sampleCount > 1 && this.attachments.depth){ //WebGPU Only
            this.depthTextureResolver = this.gal.createDepthTextureResolver?.({ source: this.attachments.depth.unresolved, destination: this.attachments.depth.texture });
        }
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