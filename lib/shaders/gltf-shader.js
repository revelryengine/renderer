import { Shader  } from './shader.js';
import { Graph   } from '../graph.js';
import { Frustum } from '../frustum.js';
import { BUFFER_USAGE, PRIMITIVE_MODES, TEXTURE_USAGE, SHADER_STAGE, GL } from '../constants.js';

import generateWGSL from './generators/gltf/gltf.wgsl.js';
import generateGLSL from './generators/gltf/gltf.glsl.js';

import { normalizers } from '../utils.js';

export class GLTFShader extends Shader {
    
    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    getHints() {
        this.createBindGroup();

        const bindGroupLayouts = [
            this.gal.device.createBindGroupLayout(Graph.bindGroupLayout),
            this.gal.device.createBindGroupLayout(Frustum.bindGroupLayout),
            this.input.renderNode.bindGroupLayout,
            this.bindGroupLayout,
        ];


        return { main: this.gal.device.createPipelineLayout({ bindGroupLayouts }) };
    }

    async init() {
        const { primitive, material, sampleCount } = this.input;

        const buffers = [
            {
                stepMode: 'instance',
                arrayStride: 16,
                attributes: [{ shaderLocation: 0, offset: 0, format: 'uint32x4' }],
            }
        ];
        
        for (const name of Object.keys(primitive.attributes)) {
            const attribute = primitive.attributes[name];
            
            if(this.locations.attr[name] !== undefined) {
                buffers.push({
                    arrayStride: attribute.bufferView?.byteStride || attribute.getElementSize(),
                    attributes: [
                        {
                            shaderLocation: this.locations.attr[name],
                            offset: 0,
                            format: this.gal.getAccessorVertexFormat(attribute),
                        }
                    ]
                });
            }
        }
        
        /** I'm not sure why but Chrome is mixing up the vertex buffers unless I sort them here */
        buffers.sort((a, b) => a.attributes[0].shaderLocation - b.attributes[0].shaderLocation);

        const targets = [];
        if(!this.flags.shadowPass) {
            targets.push({ 
                format: 'rgba8unorm',
                blend: material?.alphaMode === 'BLEND' || material?.alphaMode === 'MASK' ? {
                    color: {
                        operation: 'add',
                        srcFactor: 'src-alpha',
                        dstFactor: 'one-minus-src-alpha',
                    },
                    alpha: {
                        operation: 'add',
                        srcFactor: 'one',
                        dstFactor: 'one-minus-src-alpha',
                    }
                } : undefined,
            });
        }

        if(this.flags.storePointInfo) {
            targets.push({ format: 'rgba32float' });
        }

        if(this.flags.storeMotionVector) {
            targets.push({ format: 'rg16float' });
        }

        this.renderPipeline = await this.gal.createPipelineFromCacheAsync(this.cacheKey + JSON.stringify(buffers), {
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
                depthWriteEnabled:   true, 
                depthCompare:        'less',
                depthBias:           this.flags.shadowPass ? 1 : 0,
                depthBiasSlopeScale: this.flags.shadowPass ? 1 : 0,
            },
            primitive: {
                topology: PRIMITIVE_MODES[primitive.mode],
                cullMode: material?.doubleSided ? 'none': 'back',
                frontFace: 'ccw'
            },
            multisample: {
                count: sampleCount,
            }
        });
    }

    getFlags() {
        const { primitive, material, settings } = this.input;

        const flags = {
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

            storeMotionVector : settings.temporal,
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
            isOpaque     : material.alphaMode === 'OPAQUE',
            isMask       : material.alphaMode === 'MASK',
        });        
        return flags;
    }

    getLocations() {
        const { flags } = this;

        let attrLoc = 1, targetLoc = 0, bindingLoc = 0;
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
            for(const [name, value] of Object.entries(flags.hasTarget)) {
                if(value) locations.targets[name] = targetLoc++;
            }
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

    getCacheKey() {
        const { primitive, material, sampleCount } = this.input;

        return `${super.getCacheKey()}:${primitive.mode}:${material?.doubleSided}:${sampleCount}`;
    }

    run(renderPassEncoder, { buffer, offset, count }) {
        if(!this.ready) return;
        renderPassEncoder.setPipeline(this.renderPipeline);
        renderPassEncoder.setBindGroup(3, this.bindGroup);

        renderPassEncoder.setVertexBuffer(0, buffer);

        const { primitive } = this.input;

        for (const name of Object.keys(primitive.attributes)) {
            const attribute = primitive.attributes[name];

            if(this.locations.attr[name] !== undefined) {
                const { buffer, offset: accessorOffset } = this.gal.getBufferFromAccessor(attribute, BUFFER_USAGE.VERTEX, name);
                renderPassEncoder.setVertexBuffer(this.locations.attr[name], buffer, accessorOffset);
            }
        }

        if(primitive.indices) {
            const { buffer, format, offset: accessorOffset } = this.gal.getBufferFromAccessor(primitive.indices, BUFFER_USAGE.INDEX, 'indices');
            renderPassEncoder.setIndexBuffer(buffer, format, accessorOffset);
            renderPassEncoder.drawIndexed(primitive.indices.count, count, 0, 0, offset);
        } else {
            /**
             * If indices is not defined use draw instead with a count from any of the attributes. They should all be the same.
             * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#meshes
             */
            renderPassEncoder.draw(Object.values(primitive.attributes)[0].count, count, 0, offset);
        }
    }

    createBindGroup() {
        const { flags, locations    } = this;
        const { primitive, material } = this.input;
        const { targets } = primitive;

        const layoutEntries = [], groupEntries = [];
        if(targets?.length) {

            const vertexCount    = Object.values(primitive.attributes)[0].count;
            const maxTextureSize = Math.pow(this.gal.limits.maxTextureDimension2D, 2);
            const targetCount    = Math.min(targets.length, Math.floor(this.gal.limits.maxTextureArrayLayers));
            const textureSize    = Math.ceil(Math.sqrt(vertexCount));

            if(vertexCount > maxTextureSize) {
                console.warn('Primitive vertex count too large to apply morphs.', primitive);
                return null;
            }

            if(targetCount < targets.length) {
                console.warn('Morph targets exceeded texture array limit. Not all targets will be applied');
            }

            const usage = TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_DST;
            const size  = { width: textureSize, height: textureSize };
            
            const depthOrArrayLayers = (Number(flags.hasTarget.POSITION     || 0) 
                                        + Number(flags.hasTarget.NORMAL     || 0) 
                                        + Number(flags.hasTarget.TANGENT    || 0) 
                                        + Number(flags.hasTarget.TEXCOORD_0 || 0) 
                                        + Number(flags.hasTarget.TEXCOORD_1 || 0)
                                        + Number(flags.hasTarget.COLOR_0    || 0)) * flags.morphCount;

            const targetTexture = this.gal.device.createTexture({ format: 'rgba32float', size: { ...size, depthOrArrayLayers }, usage, array: true });
            
            for(let t = 0; t < targetCount; t++) {
                const target = targets[t];

                for(const [name, accessor] of Object.entries(target)) {
                    if(locations.targets[name] !== undefined) {
                        
                        /**
                         * There is no way to send a 3 channel packed array to a 4 channel texture, so we have to pad it here.
                         * @see https://github.com/gpuweb/gpuweb/issues/66
                         */
                        let data = accessor.getTypedArray();
                        if(accessor.type === 'VEC2' || accessor.type === 'VEC3') {
                            const padded = new data.constructor(Math.pow(textureSize, 2) * 4);
                            const componentCount = accessor.getNumberOfComponents();
                            for(let a = 0; a < accessor.count; a++) {
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

                        const offset      = locations.targets[name];
                        const destination = { texture: targetTexture, origin: { x: 0, y: 0, z: (offset * flags.morphCount) + t } };
                        const dataLayout  = { offset: 0, bytesPerRow: 16 * textureSize }
                        const size        = { width: textureSize, height: textureSize };
                        this.gal.device.queue.writeTexture(destination, data, dataLayout, size);
                    }
                }
            }
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
    

    /**
     * Returns a unique object for a given primitive and currently active material combination. 
     * This is to support KHR_materials_variants as the material may change at any moment.
     */
    static getShaderKey(primitive, material) {
        const keys = GLTFShader.#shaderKeys.get(primitive) || GLTFShader.#shaderKeys.set(primitive, new WeakMap()).get(primitive);
        return keys.get(material) || keys.set(material, { id: GLTFShader.#shaderKeyIds++ }).get(material);
    }
    static #shaderKeys   = new WeakMap();
    static #shaderKeyIds = 0;
}

export class GLTFBaseShader extends GLTFShader {
    getFlags(...args) {
        return {
            ...super.getFlags(...args),
            basePass        : true,
            useLinear       : true,
            useTransmission : false,
            useSSAO         : false,
            
            storePointInfo    : true,
            storeMotionVector : false,

            debug: null,
        }
    }
}

export class GLTFShadowShader extends GLTFShader {
    getFlags(...args) {
        return {
            ...super.getFlags(...args),
            shadowPass      : true,
            useShadows      : false,
            usePunctual     : false,
            useEnvironment  : false,
            useTransmission : false,
            useSSAO         : false,

            storeMotionVector : false,

            debug: null,
        }
    }
}

export default GLTFShader;