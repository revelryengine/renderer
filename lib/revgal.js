/**
 * Reverly Engine Graphics API Abstraction Layer
 * 
 * A simplified and unified abstraction around the WebGPU and WebGL2 APIs
 * This is not meant to be feature complete and only includes functionality required by the Revelry Engine render paths.
 */

import { BUFFER_USAGE, BUFFERVIEW_USAGE, VERTEX_FORMAT, GL, SAMPLER_PARAM, TEXTURE_USAGE, TEXTURE_FORMAT } from './constants.js';

import { CacheMap, normalizers } from './utils.js';

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

    #accessorBufferCache = new CacheMap();
    getBufferFromAccessor({ accessor, usage, name, deindex, indices }) {
        const cache = deindex && indices ? this.#accessorBufferCache.get(accessor, indices) : this.#accessorBufferCache.get(accessor);
        return cache.buffer ??= this.#createBufferFromAccessor({ accessor, usage, name, deindex, indices });
    }

    #createBufferFromAccessor({ accessor, usage = BUFFER_USAGE.VERTEX, name, deindex, indices }) {
        /** @todo optimize this so it reuses buffers based on bufferview instead of creating a new one for each accessor */
        
        const { bufferView, byteOffset } = accessor;

        usage = BUFFERVIEW_USAGE[bufferView?.target] ?? usage;

        let offset = byteOffset;
        let format = this.getAccessorVertexFormat(accessor);

        let data, arrayStride;
        if(deindex && indices) {
            data = this.#deindexAccessor(indices, accessor);
            arrayStride = accessor.getElementSize();
        } else {
            const arrayBuffer = accessor.getArrayBuffer();
            data = new Uint8Array(arrayBuffer, bufferView?.byteOffset ?? 0, bufferView?.byteLength ?? arrayBuffer.byteLength);
            arrayStride = accessor.bufferView?.byteStride ?? accessor.getElementSize();
        }

        if((usage | BUFFER_USAGE.INDEX) && format === 'uint8') {
            //convert to uint16 because uint8 is not supported by WebGPU for indices
            data   = Uint16Array.from(data);
            offset = 0;
            format = 'uint16';
        } 

        
        const buffer = this.createBufferWithData({ label: name, usage, data });

        return { buffer, format, offset, arrayStride, data };
    }

    #morphTargetCache = new CacheMap();
    getMorphTargetTexture({ primitive, deindex }) {
        const cache = deindex && primitive.indices ? this.#morphTargetCache.get(primitive, primitive.indices) : this.#morphTargetCache.get(primitive);
        return cache.targetTexture ??= this.#createMorphTargetTexture({ primitive, deindex });
    }

    #createMorphTargetTexture({ primitive, deindex }) {
        const { targets, attributes, indices } = primitive;

        const vertexCount    = (deindex ? indices?.count : null) ??  Object.values(attributes)[0].count;
        const maxTextureSize = Math.pow(this.limits.maxTextureDimension2D, 2);
        const targetCount    = Math.min(targets.length, Math.floor(this.limits.maxTextureArrayLayers));
        const textureSize    = Math.ceil(Math.sqrt(vertexCount));
        const morphCount     = targets.length;

        if(vertexCount > maxTextureSize) {
            console.warn('Primitive vertex count too large to apply morphs.', primitive);
            return null;
        }

        if(targetCount < morphCount) {
            console.warn('Morph targets exceeded texture array limit. Not all targets will be applied');
        }

        const usage = TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_DST;
        const size  = { width: textureSize, height: textureSize };

        const hasTarget = targets.reduce((accum, target) => { 
            for(const attr in attributes) {
                if(target[attr]) accum[attr] = true;
            }
            return accum;
        }, {});

        const locations = {};
        
        let targetLoc = 0;
        for(const [name, value] of Object.entries(hasTarget)) {
            if(value) locations[name] = targetLoc++;
        }
        
        const depthOrArrayLayers = (Number(hasTarget.POSITION     ?? 0) 
                                    + Number(hasTarget.NORMAL     ?? 0) 
                                    + Number(hasTarget.TANGENT    ?? 0) 
                                    + Number(hasTarget.TEXCOORD_0 ?? 0) 
                                    + Number(hasTarget.TEXCOORD_1 ?? 0)
                                    + Number(hasTarget.COLOR_0    ?? 0)) * morphCount;

        const texture = this.device.createTexture({ format: 'rgba32float', size: { ...size, depthOrArrayLayers }, usage, array: true });
        
        for(let t = 0; t < targetCount; t++) {
            const target = targets[t];

            for(const [name, accessor] of Object.entries(target)) {
                if(locations[name] !== undefined) {
                    
                    /**
                     * There is no way to send a 3 channel packed array to a 4 channel texture, so we have to pad it here.
                     * @see https://github.com/gpuweb/gpuweb/issues/66
                     */
                    let data = deindex && indices ? this.#deindexAccessor(indices, accessor) : accessor.getTypedArray();

                    if(accessor.type === 'VEC2' || accessor.type === 'VEC3') {
                        const padded = new data.constructor(Math.pow(textureSize, 2) * 4);
                        const componentCount = accessor.getNumberOfComponents();
                        for(let a = 0; a < vertexCount; a++) {
                            padded.set(data.subarray(a * componentCount, a * componentCount + componentCount), a * 4);
                        }
                        data = padded;
                    }

                    /**
                     * @todo this isn't working quite right.
                     * @see https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_mesh_quantization
                     */
                    const { componentType } = accessor;
                    if(componentType !== GL.FLOAT) {
                        const normalizer = normalizers[componentType];
                        data = Float32Array.from([...data].map(v => normalizer(v)));
                    }

                    const offset      = locations[name];
                    const destination = { texture, origin: { x: 0, y: 0, z: (offset * morphCount) + t } };
                    const dataLayout  = { offset: 0, bytesPerRow: 16 * textureSize }
                    const size        = { width: textureSize, height: textureSize };
                    this.device.queue.writeTexture(destination, data, dataLayout, size);
                }
            }
        }

        return { texture, locations }
    }
    

    #deindexAccessor(indices, accessor) {
        const indicesArray = indices.getTypedArray();

        const array = accessor.getTypedArray();
        const size  = accessor.getNumberOfComponents();
    
        const deindexed = new array.constructor(indicesArray.length * size);
    
        let index = 0, deindex = 0;
    
        for (let i = 0, l = indicesArray.length; i < l; i++) {
            if(accessor.interleaved) {
                index = indicesArray[i] * accessor.bufferView.byteStride + accessor.byteOffset + attribute.bufferView.byteOffset;
            } else {
                index = indicesArray[i] * size;
            }
            
    
            for (let j = 0; j < size; j ++) {
                deindexed[deindex++] = array[index++];
            }
    
        }
        return deindexed;
    }

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

    /**
     * 
     * @returns {String} the WebGPU format for an accessor
     * @see https://www.w3.org/TR/webgpu/#vertex-formats
     */
    static getAccessorVertexFormat(accessor) {
        const number = accessor.getNumberOfComponents();
        let format = `${VERTEX_FORMAT.gltf[accessor.normalized][accessor.componentType]}${number > 1 ? `x${number}` : ''}`;

        /**
         * @todo this isn't working quite right.
         * @see https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_mesh_quantization
         */
        if(!VERTEX_FORMAT[format] && format.endsWith('x3')){
            format = format.replace('x3', 'x4');
        }

        return format;
    }

    getAccessorVertexFormat(accessor) {
        return RevGAL.getAccessorVertexFormat(accessor);
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

    createPipelineFromCache(cacheKey, descriptor) {
        return this.#pipelines.get(cacheKey) ?? this.#pipelines.set(cacheKey, this.device.createRenderPipeline(descriptor)).get(cacheKey);
    }

    createPipelineFromCacheAsync(cacheKey, descriptor) {
        return this.#pipelines.get(cacheKey) ?? this.#pipelines.set(cacheKey, this.device.createRenderPipelineAsync(descriptor)).get(cacheKey);
    }
}

export default RevGAL;
