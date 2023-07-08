/**
 * Reverly Engine Graphics API Abstraction Layer
 * 
 * A simplified and unified abstraction around the WebGPU and WebGL2 APIs
 * This is not meant to be feature complete and only includes functionality required by the Revelry Engine render paths.
 */

import { GL, SAMPLER_PARAM, TEXTURE_USAGE, TEXTURE_FORMAT } from './constants.js';

export class RevGAL {
    get api() { return 'none'; }

    constructor(context, device, presentationFormat) {
        this.context  = context;
        this.device   = device;
        this.presentationFormat = presentationFormat;
    }

    get limits() {
        return this.device.limits;
    }

    destroy() {
        return this.device.destroy();
    }

    /**
     * Convenience method for creating a buffer from pre existing data
     */
    createBufferWithData({ data, size, ...descriptor }) {
        size ??= data.byteLength;
        size = Math.ceil(size / 4) * 4; // must be multiple of 4

        const buffer = this.device.createBuffer({ ...descriptor, size, mappedAtCreation: true });
        const range  = new data.constructor(buffer.getMappedRange());
        range.set(data);
        buffer.unmap();
        return buffer;
    }

    createTextureWithData({ data, ...descriptor }) {
        const texture = this.device.createTexture({ ...descriptor, usage: descriptor.usage | TEXTURE_USAGE.COPY_DST });

        if (data instanceof ImageBitmap || data instanceof HTMLCanvasElement || (self.OffscreenCanvas && data instanceof self.OffscreenCanvas)) {
            this.device.queue.copyExternalImageToTexture({ source: data }, { texture }, descriptor.size);
        } else {
            const { bytes } = TEXTURE_FORMAT[descriptor.format];
            const { width, height } = descriptor.size;
            const layout = { offset: 0, bytesPerRow:  bytes * width, rowsPerImage: height };
            this.device.queue.writeTexture({ texture }, data, layout, descriptor.size);
        }
        
        return texture;
    }

    createTextureFromImageBitmapData({ data, ...descriptor }) {
        const texture = this.device.createTexture({ ...descriptor, usage: descriptor.usage | TEXTURE_USAGE.COPY_DST });

        createImageBitmap(data, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' }).then(source => {
            this.device.queue.copyExternalImageToTexture({ source }, { texture }, descriptor.size);
        });

        return texture;
    }

    /************************************************/
    #gltfTextures = new WeakMap();
    getTextureFromGLTF(gltfTexture) {
        return this.#gltfTextures.get(gltfTexture) ?? this.#gltfTextures.set(gltfTexture, this.createTextureFromGLTF(gltfTexture)).get(gltfTexture);
    }

    /**
     * @see https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html#_filtering
     */
    createTextureFromGLTF(gltfTexture){
        const { 
            source, 
            sampler: {
                wrapS = GL.REPEAT,
                wrapT = GL.REPEAT,
                minFilter = GL.LINEAR_MIPMAP_LINEAR,
                magFilter = GL.LINEAR
            } = {},
            sRGB,
            extensions,
        } = gltfTexture;
    
        const sampler = this.device.createSampler({ 
            minFilter    : SAMPLER_PARAM[minFilter].filter, 
            magFilter    : SAMPLER_PARAM[magFilter].filter,
            addressModeU : SAMPLER_PARAM[wrapS],
            addressModeV : SAMPLER_PARAM[wrapT],

            mipmapFilter : SAMPLER_PARAM[minFilter].mipmap, //need to generate mipmaps first
        });

        if(extensions?.KHR_texture_basisu) {
            const { texture, loaded } = this.#createTextureFromGLTFBasisU(extensions.KHR_texture_basisu, sRGB);
            return { texture, sampler, loaded };
        } else {
            const image   = source && source.getImageData();
            const size    = { width: image.width, height: image.height };
            const usage   = TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_DST | TEXTURE_USAGE.RENDER_ATTACHMENT;
            const format  = sRGB ? 'rgba8unorm-srgb': 'rgba8unorm';
            const texture = this.createTextureWithData({ format, size, usage, data: image, sRGB });
            return { texture, sampler, loaded: true };
        }
    }

    #createTextureFromGLTFBasisU(basisuInfo, sRGB) {
        const ktx = basisuInfo.source.getImageDataKTX();
        const { pixelWidth, pixelHeight } = ktx;

        const size    = { width: pixelWidth, height: pixelHeight };
        const usage   = TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_DST;

        const supportedCompression = {
            astc : this.device.features.has('texture-compression-astc'),
            bc7  : this.device.features.has('texture-compression-bc'),
            etc2 : this.device.features.has('texture-compression-etc'),
        }
        
        let format;
        if(supportedCompression.astc) {
            format = `astc-4x4-unorm${sRGB ? '-srgb' : ''}`;
        } else if(supportedCompression.bc7){
            format = `bc7-rgba-unorm${sRGB ? '-srgb' : ''}`;
        } else if(supportedCompression.etc) {
            format = `etc2-rgb8unorm${sRGB ? '-srgb' : ''}`;
        } else {
            format = `rgba8unorm${sRGB ? '-srgb' : ''}`;
        }

        const texture = this.device.createTexture({ format, size, usage });

        const loaded = basisuInfo.transcode(supportedCompression).then(data => {
            const { bytes } = TEXTURE_FORMAT[format];
            const { width, height } = size;
            const layout = { offset: 0, bytesPerRow:  bytes * width, rowsPerImage: height };
            this.device.queue.writeTexture({ texture }, data, layout, size);
        });

        return { texture, loaded };
    }


    #vertShaders = new Map();
    #fragShaders = new Map();
    #pipelines   = new Map();
    generateShaders(shaderConstructor, input) {
        const name = shaderConstructor.name;
        let source = shaderConstructor[this.language];
        if(typeof source === 'function') {
            source = source(input);
        }
        const { cacheKey, hints  } = input;
        const { vertex, fragment } = source;

        if(shaderConstructor.debugPrintShaders) {
            console.log(shaderConstructor.name, 'Vertex', vertex);
            console.log(shaderConstructor.name, 'Fragment', fragment);
        }
        const vertShader = this.#vertShaders.get(cacheKey) ?? this.#vertShaders.set(cacheKey, this.device.createShaderModule({ label: `VertShader:${name}`, code: vertex,   hints, glType: GL.VERTEX_SHADER })).get(cacheKey);
        const fragShader = this.#fragShaders.get(cacheKey) ?? this.#fragShaders.set(cacheKey, this.device.createShaderModule({ label: `FragShader:${name}`, code: fragment, hints, glType: GL.FRAGMENT_SHADER })).get(cacheKey);
        return { vertShader, fragShader };
    }

    clearShaderCache() {
        this.#vertShaders.clear();
        this.#fragShaders.clear();
        this.#pipelines.clear();
    }    

    createPipelineFromCache({ cacheKey, descriptor }) {
        return this.#pipelines.get(cacheKey) ?? this.#pipelines.set(cacheKey, this.device.createRenderPipeline(descriptor)).get(cacheKey);
    }

    createPipelineFromCacheAsync({ cacheKey, descriptor }) {
        return this.#pipelines.get(cacheKey) ?? this.#pipelines.set(cacheKey, this.device.createRenderPipelineAsync(descriptor)).get(cacheKey);
    }

    resolveOcclusionQuerySet(querySet) {
        
    }
}

export default RevGAL;
