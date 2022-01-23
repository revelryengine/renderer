import { RevGAL } from './revgal.js';

import { ResampleShader } from './shaders/resample-shader.js';

import { BUFFER_USAGE, TEXTURE_FORMAT, TEXTURE_USAGE } from './constants.js';

export class RevGPU extends RevGAL {
    get api() { return 'webgpu'; }

    async init(target) {
        this.adapter = await navigator.gpu.requestAdapter();
        const optionalFeatures = [
            'texture-compression-astc',
            'texture-compression-etc2',
            'texture-compression-bc'
        ];
        const requiredFeatures = [];
        for(const feature of optionalFeatures) {
            if(this.adapter.features.has(feature)) {
                requiredFeatures.push(feature);
            }
        }

        this.device  = await this.adapter.requestDevice({ requiredFeatures });

        if (!this.device) throw new Error('Adapter did not provide a device');

        if(target instanceof GPUCanvasContext) {
            this.context = target;
        } else if(target instanceof HTMLCanvasElement) {
            this.context = target.getContext('webgpu');
            if(!this.context) throw new Error('Failed to get context: Make sure that WebGPU is supported');
        } else {
            throw new Error('Invalid target');
        }

        this.presentationFormat = this.context.getPreferredFormat(this.adapter);

        this.limits = this.device.limits;

        return super.init();
    }

    resize({ width, height }) {
        this.context.configure({
            device: this.device,
            format: this.presentationFormat,
            usage: TEXTURE_USAGE.OUTPUT_ATTACHMENT,
            size: { width, height },
        });
    }

    async readTexture({ texture, origin, size = {}, format }) {
        await this.device.queue.onSubmittedWorkDone();

        const { bytes } = TEXTURE_FORMAT[format];

        const { width, height, depthOrArrayLayers = 1 } = size;

        const buffer = this.device.createBuffer({ size: bytes * width * height * depthOrArrayLayers, usage: BUFFER_USAGE.COPY_DST | BUFFER_USAGE.MAP_READ });

        const commandEncoder = this.device.createCommandEncoder();

        commandEncoder.copyTextureToBuffer(
            { texture, origin },
            { buffer: buffer, bytesPerRow: bytes * width, rowsPerImage: height },
            { width, height, depthOrArrayLayers }
        );

        this.device.queue.submit([commandEncoder.finish()]);

        await buffer.mapAsync(GPUMapMode.READ);

        return buffer.getMappedRange();
    }

    generateShaders(shaders, input) {
        let { wgsl } = shaders;
        if (typeof wgsl === 'function') {
            wgsl = wgsl(input);
        }
        const { vertex, fragment, flags, cacheKey } = wgsl; /** @todo use cacheKey */
        const vertShader = this.device.createShaderModule({ code: vertex });
        const fragShader = this.device.createShaderModule({ code: fragment });
        return { vertShader, fragShader, flags };
    }

    async checkCompilation(module) {
        return module.compilationInfo();
    }

    getContextView(descriptor) {
        return this.context.getCurrentTexture().createView(descriptor);
    }

    generateMipmap(commandEncoder, texture, { format, mipLevelCount, size, viewDimension = '2d' }) {
        const { depthOrArrayLayers = 1 } = size;

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
    
                const renderPassEncoder = commandEncoder.beginRenderPass({
                    colorAttachments: [{
                        view: dstView,
                        loadValue: [0, 0, 0, 0],
                        storeOp: 'store'
                    }],
                });

                const shader = new ResampleShader(this, { view: srcView, format, viewDimension, minFilter: 'linear' });
                shader.run(renderPassEncoder, layer);
                renderPassEncoder.endPass();
            }
        }
    }
}

export default RevGPU;