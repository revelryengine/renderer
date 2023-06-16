import { RevGAL } from './revgal.js';

import { ResampleShader } from './shaders/resample-shader.js';

import { BUFFER_USAGE, TEXTURE_FORMAT, TEXTURE_USAGE } from './constants.js';

import { isCanvas } from './utils.js';

export class RevGPU extends RevGAL {
    get api()      { return 'webgpu'; }
    get language() { return 'wgsl';   }
    get ndcZO()    { return true;     }

    constructor(target, settings, device) {
        let context;

        if(target instanceof GPUCanvasContext) {
            context = target;
        } else if(isCanvas(target)) {
            context = target.getContext('webgpu');
            if(!context) throw new Error('Failed to get context: Make sure that WebGPU is supported');
        } else {
            throw new Error('Invalid target');
        }

        super(context, settings, device, navigator.gpu.getPreferredCanvasFormat());
    }

    reconfigure() {
        this.context.configure({
            alphaMode: 'premultiplied',
            device: this.device,
            format: this.presentationFormat,
            usage: TEXTURE_USAGE.OUTPUT_ATTACHMENT,
        });
    }

    async readTexture({ texture, origin, size, mipLevel = 0, }) {
        await this.device.queue.onSubmittedWorkDone();

        const { bytes } = TEXTURE_FORMAT[texture.format];

        const { width, height, depthOrArrayLayers = 1 } = size ?? texture;

        const bytesPerRow        = bytes * width;
        const bytesPerRowAligned = Math.ceil(bytesPerRow / 256) * 256;

        const buffer = this.device.createBuffer({ size: bytesPerRowAligned * height * depthOrArrayLayers, usage: BUFFER_USAGE.COPY_DST | BUFFER_USAGE.MAP_READ });

        const commandEncoder = this.device.createCommandEncoder();

        commandEncoder.copyTextureToBuffer(
            { texture, origin, mipLevel },
            { buffer, bytesPerRow: bytesPerRowAligned, rowsPerImage: height },
            { width, height, depthOrArrayLayers }
        );

        this.device.queue.submit([commandEncoder.finish()]);

        await buffer.mapAsync(GPUMapMode.READ);
        
        const pixels = new Uint8Array(bytesPerRow * height * depthOrArrayLayers);
        
        const mapped = new Uint8Array(buffer.getMappedRange());
        if(bytesPerRow !== bytesPerRowAligned) {
            for(let i = 0; i < height * depthOrArrayLayers; i++) {
                mapped.copyWithin(bytesPerRow * i, bytesPerRowAligned * i, bytesPerRowAligned * i + bytesPerRow);
            }
        }
        pixels.set(new Uint8Array(mapped.buffer, 0, bytesPerRow * height * depthOrArrayLayers));
        
        buffer.unmap();
        buffer.destroy();

        return pixels.buffer;
    }

    createMipmapGenerator(texture, { viewDimension = '2d' }) {
        const passes = [];

        const { format, mipLevelCount, depthOrArrayLayers = 1 } = texture;

        for(let layer = 0; layer < depthOrArrayLayers; layer++) {
            for (let level = 0; level < mipLevelCount - 1; level++) {
                const srcView = texture.createView({
                    dimension: viewDimension,
                    baseMipLevel: level,
                    mipLevelCount: 1,
                });
                
                const dstView = texture.createView({
                    baseMipLevel    : level + 1,
                    mipLevelCount   : 1,
                    baseArrayLayer  : layer,
                    arrayLayerCount : 1,
                });
    

                passes.push({
                    layer,
                    descriptor: {
                        label: 'generateMipMap',
                        colorAttachments: [{
                            view: dstView,
                            clearValue: [0, 0, 0, 0],
                            storeOp: 'store',
                            loadOp: 'load',
                        }],
                    },
                    shader: new ResampleShader(this, { label: 'createMipmapGenerator', view: srcView, format, viewDimension, minFilter: 'linear' }),
                })
            }
        }

        return (commandEncoder) => {
            for(const { layer, shader, descriptor } of passes) {
                const renderPassEncoder = commandEncoder.beginRenderPass(descriptor);
                shader.run(renderPassEncoder, layer);
                renderPassEncoder.end();
            }
        }
    }

    getContextView(descriptor) {
        return this.context.getCurrentTexture().createView(descriptor);
    }

    createDepthTextureResolver({ source, destination, format = 'depth24plus' }) {
        const srcView = source.createView();
        const dstView = destination.createView();

        const shader = new ResampleShader(this, { label: 'createDepthTextureResolver', view: srcView, format, viewDimension: '2d', multisampled: true });

        return (commandEncoder) => {
            const renderPassEncoder = commandEncoder.beginRenderPass({
                label: 'resolveDepthTexture',
                colorAttachments: [],
                depthStencilAttachment: {
                    view: dstView,
                    depthClearValue: 1,
                    depthStoreOp: 'store',
                    depthLoadOp: 'clear',
                },
            });

            shader.run(renderPassEncoder);
            renderPassEncoder.end();
        }
    }
}

export default RevGPU;