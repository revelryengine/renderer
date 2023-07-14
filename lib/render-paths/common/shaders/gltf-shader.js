import { BUFFER_USAGE, PRIMITIVE_MODES, TEXTURE_USAGE, SHADER_STAGE, GL, BUFFERVIEW_USAGE, VERTEX_FORMAT } from '../../../constants.js';
import { Graph   } from '../../../graph.js';
import { Frustum } from '../../../frustum.js';

import { Shader  } from './shader.js';

import generateWGSL from './generators/gltf/gltf.wgsl.js';
import generateGLSL from './generators/gltf/gltf.glsl.js';

import generateAlphaCompositeWGSL from './generators/gltf/alpha-composite.wgsl.js';
import generateAlphaCompositeGLSL from './generators/gltf/alpha-composite.glsl.js';

import { CacheMap, normalizers } from '../../../utils.js';

export class GLTFShader extends Shader {
    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    getFlags() {
        const { primitive, material, frontFace, settings } = this.input;

        const flags = {
            frontFace,

            hasAttr           : Object.fromEntries(Object.entries(primitive.attributes).map(([name, value]) => [name, !!value])),

            hasPositionVec4   : primitive.attributes.POSITION?.componentType !== GL.FLOAT, //quantized
            hasNormalVec4     : primitive.attributes.NORMAL?.componentType !== GL.FLOAT,   //quantized
            hasColor0Vec4     : primitive.attributes.COLOR_0?.type === 'VEC4',

            useTransmission   : settings.transmission?.enabled && material.extensions?.KHR_materials_transmission,
            useEnvironment    : settings.environment?.enabled,
            usePunctual       : settings.punctual?.enabled,
            useShadows        : settings.punctual?.enabled && settings.shadows?.enabled,
            useSSAO           : settings.ssao?.enabled && !material.extensions?.KHR_materials_transmission,
            useFog            : settings.fog?.enabled,

            tonemap           : settings.tonemap,
            debug             : settings.debug,
            
            isOpaque          : material.alphaMode === 'OPAQUE',
            isMask            : material.alphaMode === 'MASK',
            isBlend           : material.alphaMode === 'BLEND',

            doubleSided       : material?.doubleSided,
            lighting          : material?.extensions?.KHR_materials_unlit ? 'unlit': 'standard',
        };

        if(primitive.targets?.length) {
            Object.assign(flags, {
                morphCount : primitive.targets.length,
                hasTarget  : primitive.targets.reduce((accum, target) => { 
                    for(const attr in primitive.attributes) {
                        if(target[attr]) accum[attr] = true;
                    }
                    return accum;
                }, {})
            })
        }

        Object.assign(flags, {
            hasTexture   : Object.fromEntries(Object.entries(material.textures).map(([name, value]) => [name, !!value])),
            hasExtension : Object.fromEntries(Object.entries(material.extensions).map(([name, value]) => [name, !!value])),
            hasTransform : Object.fromEntries(Object.entries(material.textures).map(([name, texture]) => [name, !!texture?.extensions.KHR_texture_transform])),
            
            colorTargets: {
                color:  true,
                blend:  settings.alphaBlendMode === 'weighted',
                motion: settings.temporal,
            },

            writeMasks: {
                color: flags.isBlend && (settings.alphaBlendMode === 'weighted') ? 0 : 0xF,
                blend: flags.isBlend && (settings.alphaBlendMode === 'weighted') ? 0xF : 0,
            },

            depthWriteEnabled: !flags.isBlend,
        });     
        return flags;
    }

    getLocations() {
        const { flags } = this;

        let attrLoc = 1, bindingLoc = 0;
        const locations = {
            attr:     {},
            textures: {},
            targets:  {},
            target:    0,
            material:  0,
        };

        for(const [name, value] of Object.entries(flags.hasAttr)) {
            if(value) locations.attr[name] = attrLoc++;
        }

        if(flags.hasTarget){
            locations.target = bindingLoc++;
        }

        locations.material = bindingLoc++;
        for(const [name, value] of Object.entries(flags.hasTexture)) {
            if(value) {
                locations.textures[name] = bindingLoc++;
                bindingLoc++; // interleave samplers
            }
        }

        locations.bindGroup = this.input.renderNode.bindGroupLocations;
        
        return locations;
    }

    getHints() {
        this.#createAttributeBuffers();
        this.#createBindGroup();

        const bindGroupLayouts = [
            this.gal.device.createBindGroupLayout(Graph.bindGroupLayout),
            this.gal.device.createBindGroupLayout(Frustum.bindGroupLayout),
            this.input.renderNode.bindGroupLayout,
            this.bindGroupLayout,
        ];


        return { main: this.gal.device.createPipelineLayout({ bindGroupLayouts }) };
    }

    getCacheKey() {
        const { primitive, sampleCount } = this.input;
        return `${super.getCacheKey()}:${primitive.mode}:${sampleCount}:${JSON.stringify(this.vertexBufferDescriptors)}`;
    }

    #createAttributeBuffers() {
        const { input: { primitive }, locations, flags: { deindex } } = this;
        
        const buffers = {
            instance: {
                descriptor: {
                    stepMode: 'instance',
                    arrayStride: 16,
                    attributes: [{ shaderLocation: 0, offset: 0, format: 'uint32x4' }],
                }
            },
            attrs: {}
        }
        const { indices } = primitive;

        for (const name of Object.keys(locations.attr)) {
            const accessor = primitive.attributes[name];

            if(accessor) {
                const { buffer, offset, format, arrayStride, data } = this.#getBufferFromAccessor({ accessor, usage: BUFFER_USAGE.VERTEX, name, deindex, indices });
                const shaderLocation = locations.attr[name];
                buffers.attrs[name] = { 
                    buffer, offset, shaderLocation, data,
                    descriptor: {
                        arrayStride,
                        attributes: [{ shaderLocation, offset: 0, format }],
                    },
                };
            }
        }

        this.attributeBuffers = buffers;
        this.vertexBufferDescriptors = [buffers.instance.descriptor, ...Object.values(buffers.attrs).map(value => value.descriptor)];
    }

    getRenderPipelineDescriptor() {
        const { flags, input: { primitive, frontFace, sampleCount, settings } } = this;

        const buffers = this.vertexBufferDescriptors;
        
        let blendColor, blendAccum, blendReveal;
        if(flags.isBlend){
            if(settings.alphaBlendMode === 'weighted') {
                blendAccum = {
                    color: {
                        srcFactor: 'one',
                        dstFactor: 'one',
                    },
                    alpha: {
                        srcFactor: 'one',
                        dstFactor: 'one',
                    }
                };
                blendReveal = {
                    color: {
                        srcFactor: 'zero',
                        dstFactor: 'one-minus-src',
                    },
                    alpha: {
                        srcFactor: 'zero',
                        dstFactor: 'one-minus-src',
                    }
                };
            } else {
                blendColor = {
                    color: {
                        srcFactor: 'src-alpha',
                        dstFactor: 'one-minus-src-alpha',
                    },
                    alpha: {
                        srcFactor: 'one',
                        dstFactor: 'one-minus-src-alpha',
                    }
                }
            }
        }
        
        const targets = [
            flags.colorTargets.color  ? { format: 'rgba8unorm',  writeMask: flags.writeMasks.color, blend: blendColor  } : null,
            flags.colorTargets.blend  ? { format: 'rgba16float', writeMask: flags.writeMasks.blend, blend: blendAccum  } : null,
            flags.colorTargets.blend  ? { format: 'r8unorm',     writeMask: flags.writeMasks.blend, blend: blendReveal } : null,

            flags.colorTargets.point  ? { format: 'rgba32float' } : null,
            flags.colorTargets.id     ? { format: 'r32uint'     } : null,
            flags.colorTargets.motion ? { format: 'rg16float'   } : null,
        ];

        return {
            label: this.constructor.name,
            layout: this.hints.main,
            vertex:   {
                module:     this.vertShader,
                entryPoint: 'main',
                buffers,
            },
            fragment: {
                module:     this.fragShader,
                entryPoint: 'main',
                targets,
            },
            depthStencil: {
                format:              'depth24plus', 
                depthWriteEnabled:   flags.depthWriteEnabled ?? true,
                depthCompare:        'less',
                depthBias:           flags.shadowPass ? 1 : 0,
                depthBiasSlopeScale: flags.shadowPass ? 1 : 0,
            },
            primitive: {
                topology: PRIMITIVE_MODES[primitive.mode],
                cullMode: flags.doubleSided ? 'none': 'back',
                frontFace,
            },
            multisample: sampleCount > 1 ? {
                count: sampleCount,
            } : undefined
        }
    }

    

    run(renderPassEncoder, { buffer, offset, count }) {
        if(!this.ready) return;

        renderPassEncoder.setPipeline(this.renderPipeline);
        renderPassEncoder.setBindGroup(3, this.bindGroup);

        renderPassEncoder.setVertexBuffer(0, buffer);

        const { primitive } = this.input;

        for (const { buffer, shaderLocation, offset: accessorOffset } of Object.values(this.attributeBuffers.attrs)) {
            renderPassEncoder.setVertexBuffer(shaderLocation, buffer, accessorOffset);
        }

        const vertexCount = primitive.indices?.count ?? Object.values(primitive.attributes)[0].count;

        if(primitive.indices && !this.flags.deindex) {
            const { buffer, format, offset: accessorOffset } = this.#getBufferFromAccessor({ accessor: primitive.indices, usage: BUFFER_USAGE.INDEX, name: 'indices' });
            renderPassEncoder.setIndexBuffer(buffer, format, accessorOffset);
            renderPassEncoder.drawIndexed(vertexCount, count, 0, 0, offset);
        } else {
            /**
             * If indices is not defined use draw instead with a count from any of the attributes. They should all be the same.
             * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#meshes
             */
            renderPassEncoder.draw(vertexCount, count, 0, offset);
        }
    }

    #createBindGroup() {
        const { flags, locations    } = this;
        const { primitive, material } = this.input;
        const { targets } = primitive;

        const layoutEntries = [], groupEntries = [];
        if(targets?.length) {
            const { texture: targetTexture, locations: targetLocations } = this.#getMorphTargetTexture({ primitive, deindex: flags.deindex });

            locations.targets = targetLocations;

            layoutEntries.push({
                binding: locations.target,
                visibility: SHADER_STAGE.VERTEX,
                texture: {
                    viewDimension: '2d-array',
                    sampleType: 'unfilterable-float',
                }
            });
            groupEntries.push({
                binding: locations.target,
                resource: targetTexture.createView({ dimension: '2d-array' }),
            });
        }

        layoutEntries.push({
            binding: locations.material,
            visibility: SHADER_STAGE.FRAGMENT,
            buffer: {
                type: 'uniform',
            },
        });
        groupEntries.push({
            binding: locations.material,
            resource: {
                buffer: material.buffer
            }
        });

        for(const [name, loc] of Object.entries(locations.textures)) {
            const info = material.textures[name];
            const { texture, sampler } = this.gal.getTextureFromGLTF(info.texture);
            layoutEntries.push(
                {
                    binding: loc,
                    visibility: SHADER_STAGE.FRAGMENT,
                    texture: {}
                },
                {
                    binding: loc + 1,
                    visibility: SHADER_STAGE.FRAGMENT,
                    sampler: {}
                }
            );
            groupEntries.push(
                {
                    binding: loc,
                    resource: texture.createView(),
                },
                {
                    binding: loc + 1,
                    resource:  sampler,
                }
            )
        }

        this.bindGroupLayout = this.gal.device.createBindGroupLayout({ entries: layoutEntries });
        this.bindGroup       = this.gal.device.createBindGroup({ layout: this.bindGroupLayout, entries: groupEntries });
    }
    
    static #deindexAccessor(indices, accessor) {
        const indicesArray = indices.getTypedArray();

        const size      = accessor.getElementSize();
        const offset    = accessor.byteOffset + (accessor.bufferView?.byteOffset ?? 0);
        const stride    = accessor.bufferView?.byteStride ?? size;
        const array     = new Uint8Array(accessor.getArrayBuffer(), offset);
        const deindexed = new Uint8Array(indicesArray.length * size);

        let index = 0, deindex = 0;
    
        for (let i = 0, l = indicesArray.length; i < l; i++) {
            index = indicesArray[i] * stride;
                
            for (let j = 0; j < size; j++) {
                deindexed[deindex++] = array[index++];
            }
    
        }
        return new (accessor.getTypedArray().constructor)(deindexed.buffer);
    }

    static #accessorBufferCache = new CacheMap();
    #getBufferFromAccessor({ accessor, usage, name, deindex, indices }) {
        const cache = deindex && indices ? GLTFShader.#accessorBufferCache.get(indices, this.gal, accessor) : GLTFShader.#accessorBufferCache.get(this.gal, accessor);
        return cache.buffer ??= this.#createBufferFromAccessor({ accessor, usage, name, deindex, indices });
    }

    #createBufferFromAccessor({ accessor, usage = BUFFER_USAGE.VERTEX, name, deindex, indices }) {
        /** @todo optimize this so it reuses buffers based on bufferview instead of creating a new one for each accessor */
        
        const { bufferView, byteOffset } = accessor;

        usage = BUFFERVIEW_USAGE[bufferView?.target] ?? usage;

        let offset = byteOffset;
        let format = GLTFShader.#getAccessorVertexFormat(accessor);

        let data, arrayStride;
        if(deindex && indices) {
            data = GLTFShader.#deindexAccessor(indices, accessor);
            arrayStride = accessor.getElementSize();
            offset = 0;
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

        
        const buffer = this.gal.createBufferWithData({ label: name, usage, data });

        return { buffer, format, offset, arrayStride, data };
    }

    /**
     * 
     * @returns {String} the WebGPU format for an accessor
     * @see https://www.w3.org/TR/webgpu/#vertex-formats
     */
    static #getAccessorVertexFormat(accessor) {
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

    static #morphTargetCache = new CacheMap();
    #getMorphTargetTexture({ primitive, deindex }) {
        const cache = deindex && primitive.indices ? GLTFShader.#morphTargetCache.get(primitive.indices, primitive) : GLTFShader.#morphTargetCache.get(primitive);
        return cache.targetTexture ??= this.#createMorphTargetTexture({ primitive, deindex });
    }

    #createMorphTargetTexture({ primitive, deindex }) {
        const { targets, attributes, indices } = primitive;

        const vertexCount    = (deindex ? indices?.count : null) ??  Object.values(attributes)[0].count;
        const maxTextureSize = Math.pow(this.gal.limits.maxTextureDimension2D, 2);
        const targetCount    = Math.min(targets.length, Math.floor(this.gal.limits.maxTextureArrayLayers));
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

        const texture = this.gal.device.createTexture({ format: 'rgba32float', size: { ...size, depthOrArrayLayers }, usage, array: true });
        
        for(let t = 0; t < targetCount; t++) {
            const target = targets[t];

            for(const [name, accessor] of Object.entries(target)) {
                if(locations[name] !== undefined) {
                    
                    /**
                     * There is no way to send a 3 channel packed array to a 4 channel texture, so we have to pad it here.
                     * @see https://github.com/gpuweb/gpuweb/issues/66
                     */
                    let data = deindex && indices ? GLTFShader.#deindexAccessor(indices, accessor) : accessor.getTypedArray();

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
                    this.gal.device.queue.writeTexture(destination, data, dataLayout, size);
                }
            }
        }

        return { texture, locations }
    }
}

export class GLTFAlphaCompositeShader extends Shader {
    static wgsl = generateAlphaCompositeWGSL;
    static glsl = generateAlphaCompositeGLSL;

    getRenderPipelineDescriptor() {
        const { gal } = this;

        const { accum, reveal } = this.input;

        const bindGroupLayout = gal.device.createBindGroupLayout({
            label: 'AlphaComposite',
            entries: [
                { binding: 0, visibility: SHADER_STAGE.FRAGMENT, sampler: { } },
                { binding: 1, visibility: SHADER_STAGE.FRAGMENT, texture: { } },
                { binding: 2, visibility: SHADER_STAGE.FRAGMENT, texture: { } },
            ],
        });

        this.bindGroup = gal.device.createBindGroup({
            label: 'AlphaComposite',
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: gal.device.createSampler() },
                { binding: 1, resource: accum.texture.createView() },
                { binding: 2, resource: reveal.texture.createView() },
            ],
        });
        
        return {
            label: 'AlphaComposite',
            layout: gal.device.createPipelineLayout({
                bindGroupLayouts: [
                    bindGroupLayout,
                ],
            }),
            vertex:   {
                module:     this.vertShader,
                entryPoint: 'main',
            },
            fragment: {
                module:     this.fragShader,
                entryPoint: 'main',
                targets: [{ 
                    format: 'rgba8unorm',
                    blend: {
                        color: {
                            srcFactor: 'src-alpha',
                            dstFactor: 'one-minus-src-alpha',
                        },
                        alpha: {
                            srcFactor: 'src-alpha',
                            dstFactor: 'one-minus-src-alpha',
                        }
                    }
                }],
            },
        }
    }

    /**
     * 
     * @param {*} renderPassEncoder 
     */
    run(renderPassEncoder) {
        renderPassEncoder.setPipeline(this.renderPipeline);
        renderPassEncoder.setBindGroup(0, this.bindGroup);
        renderPassEncoder.draw(3, 1, 0, 0);
    }
}

export default GLTFShader;