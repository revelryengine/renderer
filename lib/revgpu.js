import { RevGAL } from './revgal.js';

import { ResampleShader } from './render-paths/common/shaders/resample-shader.js';

import { BUFFER_USAGE, TEXTURE_FORMAT, TEXTURE_USAGE } from './constants.js';

/**
 * @extends {RevGAL<GPUCanvasContext, GPUDevice>}
 */
export class RevGPU extends RevGAL {
    /**
     * @param {GPUCanvasContext|HTMLCanvasElement|OffscreenCanvas} target
     * @param {GPUDevice} device
     */
    constructor(target, device) {
        let context;

        if(target instanceof GPUCanvasContext) {
            context = target;
        } else if(RevGAL.isCanvas(target)) {
            context = /** @type {GPUCanvasContext|null} */(target.getContext('webgpu'));
            if(!context) throw new Error('Failed to get context: Make sure that WebGPU is supported');
        } else {
            throw new Error('Invalid target');
        }
        super({ context, device, api: 'webgpu', language: 'wgsl', ndcZO: true, presentationFormat: navigator.gpu.getPreferredCanvasFormat() });
    }

    reconfigure() {
        this.context.configure({
            alphaMode: 'premultiplied',
            device: this.device,
            format: this.presentationFormat,
            usage: TEXTURE_USAGE.RENDER_ATTACHMENT,
        });
    }

    /**
     * @param {GPUTexture} texture
     * @param {{ texture: GPUTexture, origin: GPUOrigin3D, size: GPUExtent3DDict, mipLevel?: number }} options
     */
    async readTexture(texture, { origin, size, mipLevel = 0, }) {
        await this.device.queue.onSubmittedWorkDone();

        const format = TEXTURE_FORMAT[texture.format];

        if(!format) throw new Error('Texture format not supported');

        const { bytes } = format;

        const { width, height = 1, depthOrArrayLayers = 1 } = size ?? texture;

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

    /**
     * @param {GPUTexture} texture
     * @param {GPUTextureViewDimension} [viewDimension]
     */
    createMipmapGenerator(texture, viewDimension = '2d') {
        /** @type {{ layer: number, descriptor: GPURenderPassDescriptor, shader: ResampleShader}[]} */
        const passes = [];

        const { format, mipLevelCount = Math.floor(Math.log2(texture.width)) + 1, depthOrArrayLayers = 1 } = texture;

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
                        label: `createMipmapGenerator ${layer}`,
                        colorAttachments: [{
                            view: dstView,
                            clearValue: [0, 0, 0, 0],
                            storeOp: 'store',
                            loadOp: 'load',
                        }],
                    },
                    shader: new ResampleShader(this, { label: `createMipmapGenerator ${layer}`, view: srcView, format, viewDimension, minFilter: 'linear' }).compile(),
                })
            }
        }

        /** @param {GPUCommandEncoder} commandEncoder */
        return (commandEncoder) => {
            for(const { layer, shader, descriptor } of passes) {
                const renderPassEncoder = commandEncoder.beginRenderPass(descriptor);
                shader.run(renderPassEncoder, layer);
                renderPassEncoder.end();
            }
        }
    }

    getContextView() {
        return this.context.getCurrentTexture().createView();
    }

    /**
     * @param {{ source: GPUTexture, destination: GPUTexture }} options
     */
    createDepthTextureResolver({ source, destination }) {
        const srcView = source.createView();
        const dstView = destination.createView();

        const shader = new ResampleShader(this, { label: 'createDepthTextureResolver', view: srcView, format: source.format, viewDimension: '2d', multisampled: true }).compile();

        /**
         * @param {GPUCommandEncoder} commandEncoder
         */
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

    /**
     * @param {GPUQuerySet} querySet
     */
    async resolveOcclusionQuerySet(querySet) {
        const size = querySet.count * 8;

        const commandEncoder = this.device.createCommandEncoder();
        const queryBuffer    = this.device.createBuffer({ size, usage: BUFFER_USAGE.QUERY_RESOLVE | BUFFER_USAGE.COPY_SRC });
        const readBuffer     = this.device.createBuffer({ size, usage: BUFFER_USAGE.COPY_DST | BUFFER_USAGE.MAP_READ })

        commandEncoder.resolveQuerySet(querySet, 0, querySet.count, queryBuffer, 0);
        commandEncoder.copyBufferToBuffer(queryBuffer, 0, readBuffer, 0, size);

        this.device.queue.submit([commandEncoder.finish()]);

        await readBuffer.mapAsync(GPUMapMode.READ);

        return new BigInt64Array(readBuffer.getMappedRange());
    }
}
