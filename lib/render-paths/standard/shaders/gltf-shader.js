import { BUFFER_USAGE, PRIMITIVE_MODES, TEXTURE_USAGE, SHADER_STAGE, GL } from '../../../constants.js';
import { Graph   } from '../../../graph.js';
import { Frustum } from '../../../frustum.js';

import { Shader  } from '../../common/shaders/shader.js';

import generateWGSL from './generators/gltf/gltf.wgsl.js';
import generateGLSL from './generators/gltf/gltf.glsl.js';

import generateAlphaCompositeWGSL from './generators/gltf/alpha-composite.wgsl.js';
import generateAlphaCompositeGLSL from './generators/gltf/alpha-composite.glsl.js';

import { normalizers } from '../../../utils.js';

export class GLTFShader extends Shader {
    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    getHints() {
        this.createAttributeBuffers();
        this.createBindGroup();

        const bindGroupLayouts = [
            this.gal.device.createBindGroupLayout(Graph.bindGroupLayout),
            this.gal.device.createBindGroupLayout(Frustum.bindGroupLayout),
            this.input.renderNode.bindGroupLayout,
            this.bindGroupLayout,
        ];


        return { main: this.gal.device.createPipelineLayout({ bindGroupLayouts }) };
    }

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
                motion: settings.temporal
            },

            writeMasks: {
                color: flags.isBlend && (settings.alphaBlendMode === 'weighted') ? 0 : 0xF,
                blend: flags.isBlend && (settings.alphaBlendMode === 'weighted') ? 0xF : 0,
            }
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

    createAttributeBuffers() {
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
                const { buffer, offset, format, arrayStride, data } = this.gal.getBufferFromAccessor({ accessor, usage: BUFFER_USAGE.VERTEX, name, deindex, indices });
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
    }

    async init() {
        const { flags, input: { primitive, frontFace, sampleCount, settings } } = this;

        const buffers = [this.attributeBuffers.instance.descriptor, ...Object.values(this.attributeBuffers.attrs).map(value => value.descriptor)];
        
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
                depthWriteEnabled:   !flags.isBlend,
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
        });
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

        for (const { buffer, shaderLocation, offset: accessorOffset, data } of Object.values(this.attributeBuffers.attrs)) {
            data;
            renderPassEncoder.setVertexBuffer(shaderLocation, buffer, accessorOffset);
        }

        const vertexCount = primitive.indices?.count ?? Object.values(primitive.attributes)[0].count;

        if(primitive.indices && !this.flags.deindex) {
            const { buffer, format, offset: accessorOffset } = this.gal.getBufferFromAccessor({ accessor: primitive.indices, usage: BUFFER_USAGE.INDEX, name: 'indices' });
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

    createBindGroup() {
        const { flags, locations    } = this;
        const { primitive, material } = this.input;
        const { targets } = primitive;

        const layoutEntries = [], groupEntries = [];
        if(targets?.length) {
            const { texture: targetTexture, locations: targetLocations } = this.gal.getMorphTargetTexture({ primitive, deindex: flags.deindex });

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
    

    /**
     * Returns a unique object for a given primitive and currently active material combination. 
     * This is to support KHR_materials_variants as the material may change at any moment.
     */
    static getShaderKey(primitive, material, frontFace) {
        const key = `${material.$id}:${frontFace}`;
        const keys = GLTFShader.#shaderKeys.get(primitive) ?? GLTFShader.#shaderKeys.set(primitive, new Map()).get(primitive);
        return keys.get(key) ?? keys.set(key, { id: GLTFShader.#shaderKeyIds++ }).get(key);
    }
    static #shaderKeys   = new WeakMap();
    static #shaderKeyIds = 0;
}

export class GLTFBaseShader extends GLTFShader {
    getFlags(...args) {
        const { settings } = this.input;

        const flags = super.getFlags(...args);
        return {
            ...flags,
            
            useLinear:       true,
            useTransmission: false,
            useSSAO:         false,
            
            debug: null,

            colorTargets: {
                color:  flags.colorTargets.color && settings.transmission.enabled,
                blend:  flags.colorTargets.blend && settings.transmission.enabled,
                point:  settings.ssao.enabled,
                id:     settings.passiveInput.enabled
            },

            writeMasks: {
                color: flags.useTransmission ? 0 : flags.writeMasks.color,
                blend: flags.writeMasks.blend,
            }
        }
    }
}

export class GLTFShadowShader extends GLTFShader {
    getFlags(...args) {
        const flags = super.getFlags(...args);
        return {
            ...flags,
            shadowPass      : true,

            useShadows      : false,
            usePunctual     : false,
            useEnvironment  : false,
            useTransmission : false,
            useSSAO         : false,

            debug: null,

            colorTargets: {
                //none
            }
        }
    }
}

export class GLTFAlphaCompositeShader extends Shader {
    static wgsl = generateAlphaCompositeWGSL;
    static glsl = generateAlphaCompositeGLSL;

    async init() {
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
        
        this.renderPipeline = gal.device.createRenderPipeline({
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
        });
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