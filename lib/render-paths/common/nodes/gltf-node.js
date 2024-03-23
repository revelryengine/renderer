import { SHADER_STAGE } from '../../../constants.js';

import { RenderNode, ColorAttachment, DepthAttachment } from '../../render-node.js';

import { GLTFShader, GLTFAlphaCompositeShader } from '../shaders/gltf-shader.js';

import { NonNull, WeakCache } from '../../../../deps/utils.js';

/**
 * @typedef {{
 *  group:  import('../../../revgal.js').REVBindGroupEntry[],
 *  layout: GPUBindGroupLayoutEntry[],
 * }} BindGroupEntries
 */

/**
 * @template {import('../../render-node.js').RenderNodeDefinition} [T=import('../../render-node.js').RenderNodeDefinition]
 * @extends {RenderNode<T & {
 *  input: {
 *      environment?:   import('../../../environment.js').Environment,
 *      envLUT?:        ColorAttachment<'rgba16float'>,
 *      envGGX?:        ColorAttachment<'rgba16float'>,
 *      envCharlie?:    ColorAttachment<'rgba16float'>,
 *      punctual?:      any,
 *      shadows?:       DepthAttachment<'depth24plus'>,
 *      shadowSampler?: import('../../../revgal.js').REVSampler,
 *      transmission?:  ColorAttachment<'rgba8unorm'>,
 *      ssao?:          ColorAttachment<'r8unorm'>,
 *  },
 *  settings: import('../../render-path-settings.js').RenderPathSettings & { flags: {
 *      transmission?:   boolean,
 *      environment?:    boolean,
 *      punctual?:       boolean,
 *      ssao?:           boolean,
 *      fog?:            boolean,
 *      tonemap?:        typeof import('../../../constants.js').PBR_TONEMAPS[number],
 *      debugPBR?:       keyof typeof import('../../../constants.js').PBR_DEBUG_MODES | 'None',
 *      temporal?:       boolean,
 *      shadows?:        boolean,
 *      passiveInput?:   boolean,
 *      alphaBlendMode?: 'weighted'|'ordered',
 *  } }
 * }>}
 */
export class GLTFNode extends RenderNode {
    Shader = GLTFShader;

    opaque       = true;
    transmissive = true;
    alpha        = true;

    attachments = {
        colors: {
            color:  new ColorAttachment({ format: 'rgba8unorm'  }),
            accum:  new ColorAttachment({ format: 'rgba16float' }),
            reveal: new ColorAttachment({ format: 'r8unorm', clearValue: [1, 1, 1, 1] }),
            point:  new ColorAttachment({ format: 'rgba32float' }),
            id:     new ColorAttachment({ format: 'r32uint'     }),
            motion: new ColorAttachment({ format: 'rg16float'   }),
        },
        depth: new DepthAttachment(),
    }
    /**
     * @type {{
     *  environment?:         number,
     *  envSampler?:          number,
     *  envLUT?:              number,
     *  envGGX?:              number,
     *  envCharlie?:          number,
     *  punctual?:            number,
     *  shadowsSampler?:      number,
     *  shadowsTexture?:      number,
     *  transmissionSampler?: number,
     *  transmissionTexture?: number,
     *  ssaoSampler?:         number,
     *  ssaoTexture?:         number,
     * }}
     */
    bindGroupLocations = {};

    /**
     * @type {import('../../../revgal.js').REVBindGroupLayout|null}
     */
    bindGroupLayout = null;

    /**
     * @type {import('../../../revgal.js').REVBindGroup|null}
     */
    bindGroup = null;

    /**
     * @param {import('../../../revgal.js').REVRenderPassEncoder} renderPassEncoder
     */
    render(renderPassEncoder) {
        const { graph, frustum } = this.passData;

        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        renderPassEncoder.setBindGroup(1, frustum.bindGroup);
        renderPassEncoder.setBindGroup(2, this.bindGroup);

        if(this.opaque)       this.renderOpaque(renderPassEncoder);
        if(this.transmissive) this.renderTransmissive(renderPassEncoder);
        if(this.alpha)        this.renderAlpha(renderPassEncoder);
    }

    /**
     * @param {import('../../../revgal.js').REVRenderPassEncoder} renderPassEncoder
     * @param {import('../../../revgal.js').REVBuffer} buffer
     * @param {import('../../../graph.js').InstanceBatch} batch
     */
    renderBlock(renderPassEncoder, buffer, { primitive, offset, count, frontFace }) {
        const material = this.passData.graph.getActiveMaterial(primitive);
        const shader   = this.getShader({ primitive, material, frontFace });
        shader.run(renderPassEncoder, { buffer, offset, count });
    }

    /**
     * @param {import('../../../revgal.js').REVRenderPassEncoder} renderPassEncoder
     */
    renderOpaque(renderPassEncoder) {
        const { instances } = this.passData;
        for(const batch of instances.opaque.batches) {
            this.renderBlock(renderPassEncoder, instances.opaque.buffer, batch);
        }
    }

    /**
     * @param {import('../../../revgal.js').REVRenderPassEncoder} renderPassEncoder
     */
    renderTransmissive(renderPassEncoder) {
        const { instances } = this.passData;

        for(const batch of instances.transmissive.batches) {
            this.renderBlock(renderPassEncoder, instances.transmissive.buffer, batch);
        }
    }

    /**
     * @param {import('../../../revgal.js').REVRenderPassEncoder} renderPassEncoder
     */
    renderAlpha(renderPassEncoder) {
        const { instances } = this.passData;
        for(const batch of instances.alpha.sorted ?? instances.alpha.batches) {
            this.renderBlock(renderPassEncoder, instances.alpha.buffer, batch);
        }
    }

    #shaderCache = new WeakCache();
    /**
     * @param {{
     *  primitive: import('../../../../deps/gltf.js').MeshPrimitive,
     *  material:  import('../../../material.js').Material,
     *  frontFace: 'cw'|'ccw',
     *  Shader?: typeof GLTFShader }} primitive
     */
    getShader({ primitive, material, frontFace, Shader = this.Shader }) {
        const cache = this.#shaderCache.ensure(Shader, primitive, material, () => ({}));

        return cache[frontFace] ??= new Shader(this.gal, {
            renderNode: this,
            primitive, material, frontFace,
            sampleCount: this.sampleCount,
        }).compileAsync();
    }

    /**
     * @param {{
    *  primitive: import('../../../../deps/gltf.js').MeshPrimitive,
    *  material:  import('../../../material.js').Material,
    *  frontFace: 'cw'|'ccw',
    *  Shader?: typeof GLTFShader }} primitive
    */
    getShaderSync({ primitive, material, frontFace, Shader = this.Shader }) {
        const cache = this.#shaderCache.ensure(Shader, primitive, material, () => ({}));

        return cache[frontFace] ??= new Shader(this.gal, {
            renderNode: this,
            primitive, material, frontFace,
            sampleCount: this.sampleCount,
        }).compile();
    }

    clearShaderCache() {
        this.#shaderCache = new WeakCache();
    }

    /**
     * @type {{
     *  shader: GLTFAlphaCompositeShader,
     *  renderPassDescriptor: import('../../../revgal.js').REVRenderPassDescriptor,
     * }|null}
     */
    #alphaComposite = null;

    /**
     * @type {RenderNode['reconfigure']}
     */
    reconfigure() {
        super.reconfigure();

        if('alphaBlendMode' in this.settings.flags) {
            const { alphaBlendMode } = this.settings.flags;

            const { alpha, attachments: { colors: { color, accum, reveal } } } = this;

            if(alpha && alphaBlendMode === 'weighted' && color?.texture) {
                this.#alphaComposite = {
                    shader:  new GLTFAlphaCompositeShader(this.gal, { accum, reveal }).compile(),
                    renderPassDescriptor: {
                        label: `${this.constructor.name} (alpha composite)`,
                        colorAttachments: [{
                            view: color.texture.createView(),
                            storeOp: 'store',
                            loadOp: 'load',
                        }],
                    }
                }
            } else {
                this.#alphaComposite = null;
            }
        }

        const { entries = { layout: [], group: [] }, bindGroupLocations = {} } = this.getBindGroupEntries() ?? {};
        this.bindGroupLocations = bindGroupLocations;

        this.bindGroupLayout = this.gal.device.createBindGroupLayout({
            label: this.constructor.name,
            entries: entries.layout,
        });

        this.bindGroup = this.gal.device.createBindGroup({
            label: this.constructor.name,
            layout: this.bindGroupLayout,
            entries: entries.group,
        });
    }

    /**
     * @param {import('../../../revgal.js').REVCommandEncoder} commandEncoder
     */
    run(commandEncoder){
        super.run(commandEncoder);
        this.#runAlphaStage(commandEncoder);
    }

    /**
     * @param {import('../../../revgal.js').REVCommandEncoder} commandEncoder
     */
    #runAlphaStage(commandEncoder) {
        if(!this.#alphaComposite)  return;

        const { shader, renderPassDescriptor } = this.#alphaComposite;

        const renderPassEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        shader.run(renderPassEncoder);
        renderPassEncoder.end();
    }

    reconfigureColorAttachments() {

    }

    /**
     * @return {{ entries: BindGroupEntries, bindGroupLocations: GLTFNode['bindGroupLocations'] }|null}
     */
    getBindGroupEntries() {
        let binding = -1;

        const bindGroupLocations = /** @type {this['bindGroupLocations']} */({})
        const entries = /** @type {BindGroupEntries} */({ layout: [], group: [] });

        if(this.input['environment']) {
            //environment
            bindGroupLocations.environment = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, buffer:  { } });
            entries.group.push({ binding, resource: { buffer: this.input['environment'].buffer } });

        }

        if(this.input['envLUT']) {
            //envSampler
            bindGroupLocations.envSampler = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, sampler: { } });
            entries.group.push({ binding, resource: this.gal.device.createSampler({ minFilter: 'linear', magFilter: 'linear', mipmapFilter: 'linear' }) });

            //envLUT
            bindGroupLocations.envLUT = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, texture: { } });
            entries.group.push({ binding, resource: NonNull(this.input['envLUT'].texture).createView() });

            //envGGX
            bindGroupLocations.envGGX = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, texture: { viewDimension: 'cube' } });
            entries.group.push({ binding, resource: NonNull(this.input['envGGX']?.texture).createView({ dimension: 'cube' }) });

            //envCharlie
            bindGroupLocations.envCharlie = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, texture: { viewDimension: 'cube' } });
            entries.group.push({ binding, resource: NonNull(this.input['envCharlie']?.texture).createView({ dimension: 'cube' }) });
        }

        this.punctual = this.input['punctual'];
        if(this.punctual) {
            //punctual
            bindGroupLocations.punctual = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT | SHADER_STAGE.VERTEX, buffer:  { } });
            entries.group.push({ binding, resource: { buffer: this.punctual.buffer } });
        }

        if(this.input['shadows']) {
            //shadowSampler
            bindGroupLocations.shadowsSampler = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, sampler: { type: 'comparison'} });
            entries.group.push({ binding, resource: this.input['shadowsSampler'] });

            //shadowTexture
            bindGroupLocations.shadowsTexture = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, texture: { viewDimension: '2d-array', sampleType: 'depth' } });
            entries.group.push({ binding, resource: NonNull(this.input['shadows'].texture).createView({ dimension: '2d-array', arrayLayerCount: 6 }) });
        }

        if(this.input['transmission']) {
            //transmissionSampler
            bindGroupLocations.transmissionSampler = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, sampler: { } });
            entries.group.push({ binding, resource: this.gal.device.createSampler({ minFilter: 'linear', magFilter: 'linear', mipmapFilter: 'linear' }) });

            //transmissionTexture
            bindGroupLocations.transmissionTexture = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, texture: { } });
            entries.group.push({ binding, resource: NonNull(this.input['transmission'].texture).createView() });
        }

        if(this.input['ssao']) {
            //ssaoSampler
            bindGroupLocations.ssaoSampler = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, sampler: { } });
            entries.group.push({ binding, resource: this.gal.device.createSampler({ minFilter: 'nearest', magFilter: 'nearest' }) });

            //ssaoTexture
            bindGroupLocations.ssaoTexture = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, texture: { } });
            entries.group.push({ binding, resource: NonNull(this.input['ssao']?.texture).createView({ dimension: '2d' }) });
        }

        return { entries, bindGroupLocations };
    }

    /**
     * @param {import('../../../graph.js').Graph} graph
     */
    async precompile(graph) {
        const { opaque, transmissive, alpha } = graph.instances;
        await Promise.all([...opaque, ...transmissive, ...alpha].map(({ primitive, frontFace }) => {
            const material = graph.getActiveMaterial(primitive);
            return this.getShader({ primitive, material, frontFace }).compiled;
        }));
    }

}
