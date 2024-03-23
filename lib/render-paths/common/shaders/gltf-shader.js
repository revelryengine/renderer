import { BUFFER_USAGE, PRIMITIVE_MODES, TEXTURE_USAGE, SHADER_STAGE, GL, BUFFERVIEW_USAGE, VERTEX_FORMAT, GLTF_VERTEX_FORMAT } from '../../../constants.js';
import { Graph   } from '../../../graph.js';
import { Frustum } from '../../../frustum.js';

import { Shader  } from './shader.js';

import generateWGSL from './generators/gltf/gltf.wgsl.js';
import generateGLSL from './generators/gltf/gltf.glsl.js';

import generateAlphaCompositeWGSL from './generators/gltf/alpha-composite.wgsl.js';
import generateAlphaCompositeGLSL from './generators/gltf/alpha-composite.glsl.js';

import { NonNull, normalizers, WeakCache } from '../../../../deps/utils.js';

/**
 * @typedef {(
*    Int8ArrayConstructor
*  | Uint8ArrayConstructor
*  | Uint8ClampedArrayConstructor
*  | Int16ArrayConstructor
*  | Uint16ArrayConstructor
*  | Int32ArrayConstructor
*  | Uint32ArrayConstructor
*  | Float32ArrayConstructor
*  | Float64ArrayConstructor
* )} TypedArrayConstructor
*/

/**
* @typedef {(
*    Int8Array
*  | Uint8Array
*  | Uint8ClampedArray
*  | Int16Array
*  | Uint16Array
*  | Int32Array
*  | Uint32Array
*  | Float32Array
*  | Float64Array
* )} TypedArray
*/

/**
 * @extends {Shader<{
 *  renderNode:  import('../nodes/gltf-node.js').GLTFNode,
 *  primitive:   import('../../../../deps/gltf.js').MeshPrimitive,
 *  material:    import('../../../material.js').Material,
 *  frontFace:   'cw'|'ccw',
 *  sampleCount: number,
 * }>}
 */
export class GLTFShader extends Shader {
    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    /**
     * @type {import('../../../revgal.js').REVBindGroupLayout|null}
     */
    bindGroupLayout = null;


    getFlags() {
        const { primitive, material, frontFace, renderNode: { settings } } = this.input;

        const flags = {
            frontFace,

            hasAttr           : /** @type {Record<import('../../../../deps/gltf.js').AttributeName, boolean>} */(Object.fromEntries(Object.entries(primitive.attributes).map(([name, value]) => [name, !!value]))),

            hasPositionVec4   : primitive.attributes.POSITION?.componentType !== GL.FLOAT, //quantized
            hasNormalVec4     : primitive.attributes.NORMAL?.componentType !== GL.FLOAT,   //quantized
            hasColor0Vec4     : primitive.attributes.COLOR_0?.type === 'VEC4',

            useTransmission   : settings.flags.transmission && !!material.extensions?.KHR_materials_transmission,
            useEnvironment    : settings.flags.environment,
            usePunctual       : settings.flags.punctual,
            useShadows        : settings.flags.punctual && settings.flags.shadows && material.receivesShadows,
            useSSAO           : settings.flags.ssao && !material.extensions?.KHR_materials_transmission,
            useFog            : settings.flags.fog,

            tonemap           : settings.flags.tonemap,
            debugPBR          : settings.flags.debugPBR ?? 'None',

            isOpaque          : material.alphaMode === 'OPAQUE',
            isMask            : material.alphaMode === 'MASK',
            isBlend           : material.alphaMode === 'BLEND',

            doubleSided       : material?.doubleSided,
            lighting          : /** @type {'standard'|'preview'|'solid'|'wireframe'|'unlit'} */(material?.extensions?.KHR_materials_unlit ? 'unlit': 'standard'),

            morphCount        : primitive.targets?.length,
            hasTarget         : primitive.targets?.reduce((accum, target) => {
                for(const attr in primitive.attributes) {
                    if(attr in target) accum[/** @type {import('../../../../deps/gltf.js').TargetName} */(attr)] = true;
                }
                return accum;
            }, /** @type {Record<import('../../../../deps/gltf.js').TargetName, boolean>} */({})),

            hasTexture   : Object.fromEntries(Object.entries(material.textures).map(([name, value]) => [name, !!value])),
            hasExtension : Object.fromEntries(Object.entries(material.extensions).map(([name, value]) => [name, !!value])),
            hasTransform : Object.fromEntries(Object.entries(material.textures).map(([name, texture]) => [name, !!texture?.extensions?.KHR_texture_transform])),

            colorTargets: /** @type {{ color?: boolean, blend?: boolean, motion?: boolean, point?: boolean, id?: boolean, accum?: boolean, reveal?: boolean }} */({
                color:  true,
                blend:  settings.flags.alphaBlendMode === 'weighted',
                motion: settings.flags.temporal,
            }),

            writeMasks: /** @type {{ color?: number, blend?: number, motion?: number, point?: number, id?: number, accum?: number, reveal?: number }} */({
                color: (material.alphaMode === 'BLEND') && (settings.flags.alphaBlendMode === 'weighted') ? 0 : 0xF,
                blend: (material.alphaMode === 'BLEND') && (settings.flags.alphaBlendMode === 'weighted') ? 0xF : 0,
            }),

            depthWriteEnabled: !(material.alphaMode === 'BLEND'),
        };

        return flags;
    }

    /**
     * @this {this & { flags: ReturnType<GLTFShader['getFlags']> }}
     */
    getLocations() {
        const { flags } = this;

        let attrLoc = 1, bindingLoc = 0;
        const locations = {
            attr:     /** @type {Record<import('../../../../deps/gltf.js').AttributeName, number>} */({}),
            textures: /** @type {Record<keyof import('../../../material.js').TexturesList, number>} */({}),
            targets:  /** @type {Record<import('../../../../deps/gltf.js').TargetName, number>} */({}),
            target:    0,
            material:  0,
            bindGroup: this.input.renderNode.bindGroupLocations,
        };

        for(const [name, value] of Object.entries(flags.hasAttr)) {
            if(value) locations.attr[/** @type {import('../../../../deps/gltf.js').AttributeName} */(name)] = attrLoc++;
        }

        if(flags.hasTarget){
            locations.target = bindingLoc++;
        }

        locations.material = bindingLoc++;
        for(const [name, value] of Object.entries(flags.hasTexture)) {
            if(value) {
                locations.textures[/** @type {keyof import('../../../material.js').TexturesList} */(name)] = bindingLoc++;
                bindingLoc++; // interleave samplers
            }
        }

        return locations;
    }

    /**
     * @this {this & { flags: ReturnType<GLTFShader['getFlags']>, locations: ReturnType<GLTFShader['getLocations']> }}
     */
    getHints() {
        this.#createAttributeBuffers();
        this.#createBindGroup();

        const bindGroupLayouts = [
            this.gal.device.createBindGroupLayout(Graph.bindGroupLayout),
            this.gal.device.createBindGroupLayout(Frustum.bindGroupLayout),
            this.input.renderNode.bindGroupLayout,
            this.bindGroupLayout,
        ].filter(n => n != null);


        return [{ entryPoint: 'main', layout: this.gal.device.createPipelineLayout({ bindGroupLayouts }) }];
    }

    getCacheKey() {
        const { primitive, sampleCount } = this.input;
        return `${super.getCacheKey()}:${primitive.mode}:${sampleCount}:${JSON.stringify(this.vertexBufferDescriptors)}`;
    }

    /**
     * @this {this & { flags: ReturnType<GLTFShader['getFlags']>, locations: ReturnType<GLTFShader['getLocations']> }}
     */
    #createAttributeBuffers() {
        const { input: { primitive }, locations, flags: { deindex } } = this;
        /**
         * @typedef {{
         *  buffer:         import('../../../revgal.js').REVBuffer,
         *  offset:         number,
         *  data:           TypedArray,
         *  shaderLocation: number,
         *  descriptor:     GPUVertexBufferLayout
         * }} BufferInfo
         */

        const buffers = {
            instance: /** @type {const} */({
                descriptor: {
                    stepMode: 'instance',
                    arrayStride: 16,
                    attributes: [{ shaderLocation: 0, offset: 0, format: 'uint32x4' }],
                }
            }),
            attrs: /** @type {Record<keyof import('../../../../deps/gltf.js').MeshPrimitive['attributes'], BufferInfo>} */({})
        }
        const { indices } = primitive;

        for (const n of Object.keys(locations.attr)) {
            const name = /** @type {keyof import('../../../../deps/gltf.js').MeshPrimitive['attributes']} */(n)
            const accessor = primitive.attributes[name];

            if(accessor) {
                const { buffer, offset, format, arrayStride, data } = this.#getBufferFromAccessor({ accessor, usage: BUFFER_USAGE.VERTEX, name, deindex, indices });
                const shaderLocation = locations.attr[name];
                buffers.attrs[name] = {
                    buffer, offset, shaderLocation, data,
                    descriptor: {
                        arrayStride,
                        attributes: [{ shaderLocation, offset: 0, format: /** @type {GPUVertexFormat} */(format) }],
                    },
                };
            }
        }

        this.attributeBuffers = buffers;
        this.vertexBufferDescriptors = [buffers.instance.descriptor, ...Object.values(buffers.attrs).map(value => value.descriptor)];
    }

    /**
     * @type {Shader['getRenderPipelineDescriptor']}
     * @this {this & { flags: ReturnType<GLTFShader['getFlags']>, hints: ReturnType<GLTFShader['getHints']> }}
     */
    getRenderPipelineDescriptor(stages) {

        const { flags, input: { primitive, frontFace, sampleCount, renderNode: { settings } } } = this;

        const buffers = this.vertexBufferDescriptors;

        let blendColor, blendAccum, blendReveal;
        if(flags.isBlend){
            if(settings.flags.alphaBlendMode === 'weighted') {
                blendAccum = /** @type {const} */({
                    color: {
                        srcFactor: 'one',
                        dstFactor: 'one',
                    },
                    alpha: {
                        srcFactor: 'one',
                        dstFactor: 'one',
                    }
                });
                blendReveal = /** @type {const} */({
                    color: {
                        srcFactor: 'zero',
                        dstFactor: 'one-minus-src',
                    },
                    alpha: {
                        srcFactor: 'zero',
                        dstFactor: 'one-minus-src',
                    }
                });
            } else {
                blendColor = /** @type {const} */({
                    color: {
                        srcFactor: 'src-alpha',
                        dstFactor: 'one-minus-src-alpha',
                    },
                    alpha: {
                        srcFactor: 'one',
                        dstFactor: 'one-minus-src-alpha',
                    }
                })
            }
        }

        const targets = /** @type {const} */([
            flags.colorTargets.color  ? /** @type {const} */({ format: 'rgba8unorm',  writeMask: flags.writeMasks.color, blend: blendColor  }) : null,
            flags.colorTargets.blend  ? /** @type {const} */({ format: 'rgba16float', writeMask: flags.writeMasks.blend, blend: blendAccum  }) : null,
            flags.colorTargets.blend  ? /** @type {const} */({ format: 'r8unorm',     writeMask: flags.writeMasks.blend, blend: blendReveal }) : null,

            flags.colorTargets.point  ? /** @type {const} */({ format: 'rgba32float' }) : null,
            flags.colorTargets.id     ? /** @type {const} */({ format: 'r32uint'     }) : null,
            flags.colorTargets.motion ? /** @type {const} */({ format: 'rg16float'   }) : null,
        ]);

        return {
            label: this.constructor.name,
            layout: this.hints[0].layout,
            vertex:   {
                module:     stages.vertex,
                entryPoint: 'main',
                buffers,
            },
            fragment: {
                module:     stages.fragment,
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

    /**
     * @param {import('../../../revgal.js').REVRenderPassEncoder} renderPassEncoder
     * @param {{ buffer: import('../../../revgal.js').REVBuffer, offset: number, count: number }} options
     *
     * @this {this & { flags: ReturnType<GLTFShader['getFlags']> }}
     */
    run(renderPassEncoder, { buffer, offset, count }) {
        if(!this.renderPipeline) return;

        renderPassEncoder.setPipeline(this.renderPipeline);
        renderPassEncoder.setBindGroup(3, this.bindGroup);

        renderPassEncoder.setVertexBuffer(0, buffer);

        const { primitive } = this.input;

        for (const { buffer, shaderLocation, offset: accessorOffset } of Object.values(NonNull(this.attributeBuffers).attrs)) {
            renderPassEncoder.setVertexBuffer(shaderLocation, buffer, accessorOffset);
        }

        const vertexCount = primitive.indices?.count ?? Object.values(primitive.attributes)[0].count;

        if(primitive.indices && !this.flags.deindex) {
            const { buffer, format, offset: accessorOffset } = this.#getBufferFromAccessor({ accessor: primitive.indices, usage: BUFFER_USAGE.INDEX, name: 'indices' });
            renderPassEncoder.setIndexBuffer(buffer, /** @type {GPUIndexFormat} */(format), accessorOffset);
            renderPassEncoder.drawIndexed(vertexCount, count, 0, 0, offset);
        } else {
            /**
             * If indices is not defined use draw instead with a count from any of the attributes. They should all be the same.
             * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#meshes
             */
            renderPassEncoder.draw(vertexCount, count, 0, offset);
        }
    }

    /**
     * @this {this & { flags: ReturnType<GLTFShader['getFlags']>, locations: ReturnType<GLTFShader['getLocations']> }}
     */
    #createBindGroup() {
        const { flags, locations    } = this;
        const { primitive, material } = this.input;
        const { targets } = primitive;

        const layoutEntries = [], groupEntries = [];
        if(targets?.length) {
            const { texture: targetTexture, locations: targetLocations } = NonNull(this.#getMorphTargetTexture({ primitive, deindex: flags.deindex }));

            locations.targets = targetLocations;

            layoutEntries.push({
                binding: locations.target,
                visibility: SHADER_STAGE.VERTEX,
                texture: /** @type {const} */({
                    viewDimension: '2d-array',
                    sampleType:    'unfilterable-float',
                })
            });
            groupEntries.push({
                binding: locations.target,
                resource: targetTexture.createView({ dimension: '2d-array' }),
            });
        }

        layoutEntries.push({
            binding: locations.material,
            visibility: SHADER_STAGE.FRAGMENT,
            buffer: /** @type {const} */({
                type: 'uniform',
            }),
        });
        groupEntries.push({
            binding: locations.material,
            resource: {
                buffer: material.buffer
            }
        });

        for(const [name, loc] of Object.entries(locations.textures)) {
            const info = NonNull(material.textures[/** @type {keyof import('../../../material.js').TexturesList} */(name)]);
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

    /**
     * @param {import('../../../../deps/gltf.js').Accessor} indices
     * @param {import('../../../../deps/gltf.js').Accessor} accessor
     */
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
        return new (/** @type {TypedArrayConstructor} */(accessor.getTypedArray().constructor))(deindexed.buffer);
    }

    /**
     * @type {WeakCache<{
     *  buffer: { buffer: import('../../../revgal.js').REVBuffer, format: GPUVertexFormat | 'uint16', offset: number, arrayStride: number, data: TypedArray },
     * }>}
     */
    static #accessorBufferCache = new WeakCache();


    /**
     * @param {{
     *  accessor: import('../../../../deps/gltf.js').Accessor,
     *  usage:    import('../../../constants.js').BUFFER_USAGE,
     *  name:     string,
     *  deindex?: boolean,
     *  indices?: import('../../../../deps/gltf.js').Accessor
     * }} options
     */
    #getBufferFromAccessor({ accessor, usage, name, deindex, indices }) {
        let cache;
        if(deindex && indices) {
            cache = GLTFShader.#accessorBufferCache.ensure(indices, this.gal, accessor, () => ({
                buffer: this.#createBufferFromAccessor({ accessor, usage, name, deindex, indices }),
            }));
        } else {
            cache = GLTFShader.#accessorBufferCache.ensure(this.gal, accessor, () => ({
                buffer: this.#createBufferFromAccessor({ accessor, usage, name })
            }));
        }
        return cache.buffer;
    }

    /**
     * @param {{
     *  accessor: import('../../../../deps/gltf.js').Accessor,
     *  usage:    import('../../../constants.js').BUFFER_USAGE,
     *  name:     string,
     *  deindex?: boolean,
     *  indices?: import('../../../../deps/gltf.js').Accessor
     * }} options
     */
    #createBufferFromAccessor({ accessor, usage = BUFFER_USAGE.VERTEX, name, deindex, indices }) {
        /** @todo optimize this so it reuses buffers based on bufferview instead of creating a new one for each accessor */

        const { bufferView, byteOffset } = accessor;

        usage = bufferView?.target ? BUFFERVIEW_USAGE[bufferView.target] : usage;

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


        if(format === 'uint8') {
            //convert to uint16 because WebGPU does not support uint8 for indices
            data   = Uint16Array.from(data);
            offset = 0;
            format = 'uint16';
        }

        const buffer = this.gal.createBufferWithData({ label: name, usage, data });

        return { buffer, format, offset, arrayStride, data };
    }

    /**
     * @param {import('../../../../deps/gltf.js').Accessor} accessor
     * @see https://www.w3.org/TR/webgpu/#vertex-formats
     */
    static #getAccessorVertexFormat(accessor) {
        const number = accessor.getNumberOfComponents();
        let format = /** @type {keyof VERTEX_FORMAT} */(`${GLTF_VERTEX_FORMAT[accessor.normalized ? 'normalized' : 'unnormalized'][accessor.componentType]}${number > 1 ? `x${number}` : ''}`);

        /**
         * @todo this isn't working quite right.
         * @see https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_mesh_quantization
         */
        if(!VERTEX_FORMAT[format] && format.endsWith('x3')){
            format = /** @type {keyof VERTEX_FORMAT} */(format.replace('x3', 'x4'));
        }

        return format;
    }

    /**
     * @type {WeakCache<{
     *  targetTexture: { texture: import('../../../revgal.js').REVTexture, locations: Record<string, number> } | null
     * }>}
     */
    static #morphTargetCache = new WeakCache();

    /**
     * @param {{ primitive: import('../../../../deps/gltf.js').MeshPrimitive, deindex: boolean }} options
     * @this {this & { flags: ReturnType<GLTFShader['getFlags']> }}
     */
    #getMorphTargetTexture({ primitive, deindex }) {
        let cache;
        if(deindex && primitive.indices) {
            cache = GLTFShader.#morphTargetCache.ensure(primitive.indices, primitive, () => ({
                targetTexture: this.#createMorphTargetTexture({ primitive, deindex })
            }));
        } else {
            cache = GLTFShader.#morphTargetCache.ensure(primitive, () => ({
                targetTexture: this.#createMorphTargetTexture({ primitive, deindex })
            }));
        }
        return cache.targetTexture
    }

    /**
     * @param {{ primitive: import('../../../../deps/gltf.js').MeshPrimitive, deindex: boolean }} options
     * @this {this & { flags: ReturnType<GLTFShader['getFlags']> }}
     */
    #createMorphTargetTexture({ primitive, deindex }) {
        if(!primitive.targets || !this.flags.hasTarget) return null;

        const { targets, attributes, indices } = primitive;

        const vertexCount    = (deindex ? indices?.count : null) ??  Object.values(attributes)[0].count;
        const maxTextureSize = Math.pow(this.gal.limits.maxTextureDimension2D, 2);
        const textureSize    = Math.ceil(Math.sqrt(vertexCount));
        const morphCount     = targets.length;

        if(vertexCount > maxTextureSize) {
            console.warn('Primitive vertex count too large to apply morphs.', primitive);
            return null;
        }

        const layersPerTarget = Object.values(this.flags.hasTarget).length;
        const targetCount = Math.min(morphCount, Math.floor(this.gal.limits.maxTextureArrayLayers / layersPerTarget));

        if(targetCount < morphCount) {
            console.warn('Morph targets exceeded texture array limit. Not all targets will be applied');
        }

        const usage = TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_DST;
        const size  = { width: textureSize, height: textureSize };

        const locations = /** @type {Record<keyof NonNullable<this['flags']>['hasTarget'], number> }*/({});

        let targetLoc = 0;
        for(const [name, value] of Object.entries(this.flags.hasTarget)) {
            if(value) locations[/** @type {keyof NonNullable<this['flags']>['hasTarget']} */(name)] = targetLoc++;
        }

        const texture = this.gal.device.createTexture({ format: 'rgba32float', size: { ...size, depthOrArrayLayers: targetCount * layersPerTarget }, usage, glArray: true });

        for(let t = 0; t < targetCount; t++) {
            const target = targets[t];

            for(const [name, a] of Object.entries(target)) {
                if(a && locations[name] !== undefined) {
                    const accessor = /** @type {import('../../../../deps/gltf.js').Accessor} */(a);
                    /**
                     * There is no way to send a 3 channel packed array to a 4 channel texture, so we have to pad it here.
                     * @see https://github.com/gpuweb/gpuweb/issues/66
                     */
                    let data = deindex && indices ? GLTFShader.#deindexAccessor(indices, accessor) : accessor.getTypedArray();

                    if(accessor.type === 'VEC2' || accessor.type === 'VEC3') {
                        const padded = new /** @type {TypedArrayConstructor} */(data.constructor)(Math.pow(textureSize, 2) * 4);
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
                    if(componentType !== GL.FLOAT && componentType !== GL.UNSIGNED_INT) {
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

    /**
     * @type {Shader['getRenderPipelineDescriptor']}
     */
    getRenderPipelineDescriptor(stages) {
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
                module:     stages.vertex,
                entryPoint: 'main',
            },
            fragment: {
                module:     stages.fragment,
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
     * @type {Shader['run']}
     */
    run(renderPassEncoder) {
        if(!this.renderPipeline) return;
        renderPassEncoder.setPipeline(this.renderPipeline);
        renderPassEncoder.setBindGroup(0, this.bindGroup);
        renderPassEncoder.draw(3, 1, 0, 0);
    }
}
