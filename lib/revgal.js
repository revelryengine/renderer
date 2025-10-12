/**
 * @typedef {import('./revgal.js').RevGAL} RevGALClass
 */

/**
 * Reverly Engine Graphics API Abstraction Layer
 *
 * An abstraction around the WebGPU and WebGL2 APIs using the lowest common denominator.
 * This is not meant to be feature complete and only includes functionality required by the Revelry Engine render paths.
 */

import { GL, SAMPLER_PARAMS, TEXTURE_USAGE, TEXTURE_FORMAT } from './constants.js';

/**
 * @implements {RevGALClass}
 */
export class RevGAL {
    /**
     * @param {{
     *  context:  { canvas: HTMLCanvasElement | OffscreenCanvas },
     *  device:   import('./revgal.js').REVDevice & import('./revgal.js').REVDeviceExtended,
     *  api:      'webgpu'|'webgl2',
     *  language: 'wgsl'|'glsl',
     *  ndcZO:    boolean,
     *  presentationFormat: GPUTextureFormat,
     * }} options
     */
    constructor({ context, device, api, language, ndcZO, presentationFormat }) {
        this.context  = context;
        this.device   = device;
        this.api      = api;
        this.language = language;
        this.ndcZO    = ndcZO;
        this.presentationFormat = presentationFormat;

        this.reconfigure();
    }

    get limits() {
        return this.device.limits;
    }

    destroy() {
        return this.device.destroy();
    }

    /** @type {RevGALClass['reconfigure']} */
    reconfigure() {
        throw new Error('Not implemented');
    }

    /** @type {RevGALClass['getContextView']} */
    getContextView() {
        throw new Error('Not implemented');
    }

    /**
     * Convenience method for creating a buffer from pre existing data
     *
     * @param {{ data: import('../deps/utils.js').TypedArray, size?: number } & Omit<GPUBufferDescriptor, 'size'>} options
     */
    createBufferWithData({ data, size, ...descriptor }) {
        size ??= data.byteLength;
        size = Math.ceil(size / 4) * 4; // must be multiple of 4

        const buffer = this.device.createBuffer({ ...descriptor, size, mappedAtCreation: true });
        const range  = new /** @type {import('../deps/utils.js').TypedArrayConstructor} */(data.constructor)(buffer.getMappedRange());
        range.set(data);
        buffer.unmap();
        return buffer;
    }


    /**
     * Convenience method for creating a texture from pre existing data
     * @param {{ data: ImageBitmapSource|HTMLCanvasElement|OffscreenCanvas|BufferSource|SharedArrayBuffer, size: GPUExtent3DDict } & GPUTextureDescriptor } options
     */
    createTextureWithData({ data, ...descriptor }) {
        const texture = this.device.createTexture({ ...descriptor, usage: descriptor.usage | TEXTURE_USAGE.COPY_DST });

        if (data instanceof ImageBitmap || (self.HTMLCanvasElement && data instanceof self.HTMLCanvasElement) || (self.OffscreenCanvas && data instanceof self.OffscreenCanvas)) {
            this.device.queue.copyExternalImageToTexture({ source: data }, { texture }, descriptor.size);
        } else {
            const format = TEXTURE_FORMAT[descriptor.format];

            if(!format) throw new Error('Format not supported');

            const { bytes } = format;
            const { width, height } = descriptor.size;
            const layout = { offset: 0, bytesPerRow:  bytes * width, rowsPerImage: height };
            this.device.queue.writeTexture({ texture }, data, layout, descriptor.size);
        }

        return texture;
    }

    /**
     * Convenience method for creating a texture from pre existing data
     *
     * @param {{ data: ImageBitmapSource } & GPUTextureDescriptor } options
     */
    createTextureFromImageBitmapData({ data, ...descriptor }) {
        const texture = this.device.createTexture({ ...descriptor, usage: descriptor.usage | TEXTURE_USAGE.COPY_DST });

        createImageBitmap(data, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' }).then(source => {
            this.device.queue.copyExternalImageToTexture({ source }, { texture }, descriptor.size);
        });

        return texture;
    }

    /************************************************/
    #gltfTextures = new WeakMap();
    /**
     * @param {import('../deps/gltf.js').Texture} gltfTexture
     */
    getTextureFromGLTF(gltfTexture) {
        return this.#gltfTextures.get(gltfTexture) ?? this.#gltfTextures.set(gltfTexture, this.createTextureFromGLTF(gltfTexture)).get(gltfTexture);
    }

    /**
     * @see https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html#_filtering
     *
     * @param {import('../deps/gltf.js').Texture} gltfTexture
     */
    createTextureFromGLTF(gltfTexture){
        const {
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
            magFilter    : SAMPLER_PARAMS.magFilterMode[magFilter],
            addressModeU : SAMPLER_PARAMS.addressMode[wrapS],
            addressModeV : SAMPLER_PARAMS.addressMode[wrapT],

            minFilter    : SAMPLER_PARAMS.minFilterMode[minFilter].filter,
            mipmapFilter : SAMPLER_PARAMS.minFilterMode[minFilter].mipmap, //need to generate mipmaps first
        });

        if(extensions?.KHR_texture_basisu) {
            const { texture, loaded } = this.#createTextureFromGLTFBasisU(extensions.KHR_texture_basisu, sRGB);
            return { texture, sampler, loaded };
        } else {
            const image = gltfTexture.getSource()?.getImageData();
            if(!(image instanceof ImageBitmap)) throw new Error('Image data not supported');

            const size    = { width: image.width, height: image.height };
            const usage   = TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_DST | TEXTURE_USAGE.RENDER_ATTACHMENT;
            const format  = sRGB ? 'rgba8unorm-srgb': 'rgba8unorm';
            const texture = this.createTextureWithData({ format, size, usage, data: image });
            return { texture, sampler, loaded: Promise.resolve() };
        }
    }

    /**
     * @param {import('../deps/gltf.js').KHRTextureBasisuTexture} basisuInfo
     * @param {boolean} sRGB
     */
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

        /** @type {GPUTextureFormat} */
        let format;
        if(supportedCompression.astc) {
            format = `astc-4x4-unorm${sRGB ? '-srgb' : ''}`;
        } else if(supportedCompression.bc7){
            format = `bc7-rgba-unorm${sRGB ? '-srgb' : ''}`;
        } else if(supportedCompression.etc2) {
            format = `etc2-rgb8unorm${sRGB ? '-srgb' : ''}`;
        } else {
            format = `rgba8unorm${sRGB ? '-srgb' : ''}`;
        }

        const texture = this.device.createTexture({ format, size, usage });

        const loaded = basisuInfo.transcode(supportedCompression).then(data => {
            const { bytes } = /** @type {{ bytes: number }} */(TEXTURE_FORMAT[format]);
            const { width, height } = size;
            const layout = { offset: 0, bytesPerRow:  bytes * width, rowsPerImage: height };
            this.device.queue.writeTexture({ texture }, data, layout, size);
        });

        return { texture, loaded };
    }


    #vertShaders = new Map();
    #fragShaders = new Map();
    #pipelines   = new Map();

    /**
     * @template {import('./render-paths/common/shaders/shader.js').ShaderConstructor} T
     * @param {T} shaderConstructor
     * @param {import('./render-paths/common/shaders/shader.js').ShaderInitialized<InstanceType<T>>} input
     */
    generateShaders(shaderConstructor, input) {
        if(this.language !== 'wgsl' && this.language !== 'glsl') throw new Error('Invalid language');

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

        const stages = {
            vertex:   this.#vertShaders.get(cacheKey) ?? this.#vertShaders.set(cacheKey, this.device.createShaderModule({ label: `VertShader:${name}`, code: vertex,   compilationHints: hints, glType: GL.VERTEX_SHADER })).get(cacheKey),
            fragment: this.#fragShaders.get(cacheKey) ?? this.#fragShaders.set(cacheKey, this.device.createShaderModule({ label: `FragShader:${name}`, code: fragment, compilationHints: hints, glType: GL.FRAGMENT_SHADER })).get(cacheKey),
        }

        return { stages, source };
    }

    clearShaderCache() {
        this.#vertShaders.clear();
        this.#fragShaders.clear();
        this.#pipelines.clear();
    }

    /**
     * @param {{
     *  cacheKey: string,
     *  descriptor: import('./revgal.js').REVRenderPipelineDescriptor
     * }} cacheKey
     */
    createPipelineFromCache({ cacheKey, descriptor }) {
        return this.#pipelines.get(cacheKey) ?? this.#pipelines.set(cacheKey, this.device.createRenderPipeline(descriptor)).get(cacheKey);
    }

    /**
     * @param {{
     *  cacheKey: string,
     *  descriptor: import('./revgal.js').REVRenderPipelineDescriptor
     * }} cacheKey
     */
    createPipelineFromCacheAsync({ cacheKey, descriptor }) {
        return this.#pipelines.get(cacheKey) ?? this.#pipelines.set(cacheKey, this.device.createRenderPipelineAsync(descriptor)).get(cacheKey);
    }

    /** @type {RevGALClass['createMipmapGenerator']} */
    createMipmapGenerator() {
        throw new Error('not implemented');
    }

    /**
     * @param {any} target
     * @returns {target is WebGL2RenderingContext|GPUCanvasContext}
     */
    static isRenderingContext(target) {
        return this.isGL2Context(target) || this.isGPUContext(target);
    }

    /**
     * @param {any} target
     * @returns {target is (HTMLCanvasElement | OffscreenCanvas)}
     */
    static isCanvas(target) {
        //OffscreenCanvas may not be defined if browser does not support it
        return (globalThis.HTMLCanvasElement && target instanceof globalThis.HTMLCanvasElement || (globalThis.OffscreenCanvas && target instanceof globalThis.OffscreenCanvas));
    }

    /**
     * @param {any} target
     * @returns {target is WebGL2RenderingContext}
     */
    static isGL2Context(target) {
        //WebGL2RenderingContext may not be defined if browser does not support it
        return  (globalThis.WebGL2RenderingContext && target instanceof globalThis.WebGL2RenderingContext);
    }

    /**
     * @param {any} target
     * @returns {target is GPUCanvasContext}
     */
    static isGPUContext(target) {
        //GPUCanvasContext may not be defined if browser does not support it
        return  (globalThis.GPUCanvasContext && target instanceof globalThis.GPUCanvasContext);
    }

    async resolveOcclusionQuerySet() {
        return new BigInt64Array();
    }

    async readTexture() {
        return new ArrayBuffer(0);
    }

    /**
     * requestAnimationFrame polyfill modified from https://gist.github.com/paulirish/1579671
     */
    requestAnimationFrame = globalThis.requestAnimationFrame?.bind(globalThis) ?? (() => {
        let lastTime  = 0;
        return (callback) => {
            const currTime   = performance.now();
            const timeToCall = Math.max(0, 16 - (currTime - lastTime));
            const id = globalThis.setTimeout(() => callback(currTime + timeToCall), timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        }
    })();

    /** cancelAnimationFrame polyfill */
    cancelAnimationFrame = globalThis.cancelAnimationFrame?.bind(globalThis) ?? globalThis.clearTimeout.bind(globalThis);
}
