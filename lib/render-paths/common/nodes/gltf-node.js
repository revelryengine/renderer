import { SHADER_STAGE } from '../../../constants.js';

import { RenderNode } from '../../render-node.js';

import { GLTFShader, GLTFAlphaCompositeShader } from '../shaders/gltf-shader.js';

import { WeakCache } from '../../../../deps/utils.js';

export class GLTFNode extends RenderNode {
    Shader = GLTFShader;

    attachments = {
        colors: {
            color:  { location: 0, format: 'rgba8unorm'  },
            accum:  { location: 1, format: 'rgba16float' },
            reveal: { location: 2, format: 'r8unorm', clearValue: [1, 1, 1, 1] },
            point:  { location: 3, format: 'rgba32float' },
            id:     { location: 4, format: 'r32uint'     },
            motion: { location: 5, format: 'rg16float'   },
        },
        depth: { },
    }

    render(renderPassEncoder, { graph, frustum, instances }) {
        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        renderPassEncoder.setBindGroup(1, frustum.bindGroup);
        renderPassEncoder.setBindGroup(2, this.bindGroup);


        if(this.opaque)       this.renderOpaque(renderPassEncoder, { graph, instances });
        if(this.transmissive) this.renderTransmissive(renderPassEncoder, { graph, instances });
        if(this.alpha)        this.renderAlpha(renderPassEncoder, { graph, instances });
    }

    renderBlock(renderPassEncoder, graph, buffer, { primitive, offset, count, frontFace }) {
        const material = graph.getActiveMaterial(primitive);
        const shader   = this.getShader({ primitive, material, frontFace });
        shader.run(renderPassEncoder, { buffer, offset, count });
    }


    renderOpaque(renderPassEncoder, { graph, instances }) {
        for(const batch of instances.opaque.batches) {
            this.renderBlock(renderPassEncoder, graph, instances.opaque.buffer, batch);
        }
    }

    renderTransmissive(renderPassEncoder, { graph, instances }) {
        for(const batch of instances.transmissive.batches) {
            this.renderBlock(renderPassEncoder, graph, instances.transmissive.buffer, batch);
        }
    }

    renderAlpha(renderPassEncoder, { graph, instances }) {
        for(const batch of instances.alpha.sorted ?? instances.alpha.batches) {
            this.renderBlock(renderPassEncoder, graph, instances.alpha.buffer, batch);
        }
    }

    #shaderCache = new WeakCache();
    getShader({ primitive, material, frontFace, Shader = this.Shader }) {
        const cache = this.#shaderCache.ensure(Shader, primitive, material, () => ({}));

        return cache[frontFace] ??= new Shader(this.gal, {
            settings: this.renderPath.settings, renderNode: this,
            primitive, material, frontFace,
            sampleCount: this.sampleCount,
        }).compileAsync();
    }

    getShaderSync({ primitive, material, frontFace, Shader = this.Shader }) {
        const cache = this.#shaderCache.ensure(Shader, primitive, material, () => ({}));

        return cache[frontFace] ??= new Shader(this.gal, {
            settings: this.renderPath.settings, renderNode: this,
            primitive, material, frontFace,
            sampleCount: this.sampleCount,
        }).compile();
    }

    clearShaderCache() {
        this.#shaderCache = new WeakCache();
    }

    #alphaComposite;
    reconfigure() {
        super.reconfigure();

        const { alphaBlendMode } = this.settings.flags;

        const { alpha, attachments: { colors: { color, accum, reveal } } } = this;

        if(alpha && alphaBlendMode === 'weighted' && (color && (color.enabled ?? true))) {
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

    run(commandEncoder, ...args){
        super.run(commandEncoder, ...args);
        this.#alphaComposite && this.#runAlphaStage(commandEncoder, this.#alphaComposite);
    }

    #runAlphaStage(commandEncoder, { shader, renderPassDescriptor }) {
        const renderPassEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        shader.run(renderPassEncoder);
        renderPassEncoder.end();
    }

    reconfigureColorAttachments() {

    }

    getBindGroupEntries() {
        let binding = -1;

        const bindGroupLocations = {}
        const entries = { layout: [], group: [] };

        this.environment = this.getConnectionValue('environment');
        if(this.environment) {
            //environment
            bindGroupLocations.environment = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, buffer:  { } });
            entries.group.push({ binding, resource: { buffer: this.environment.buffer } });

        }

        if(this.getConnectionValue('envLUT')) {
            //envSampler
            bindGroupLocations.envSampler = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, sampler: { } });
            entries.group.push({ binding, resource: this.gal.device.createSampler({ minFilter: 'linear', magFilter: 'linear', mipmapFilter: 'linear' }) });

            //envLUT
            bindGroupLocations.envLUT = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, texture: { } });
            entries.group.push({ binding, resource: this.getConnectionValue('envLUT').texture.createView() });

            //envGGX
            bindGroupLocations.envGGX = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, texture: { viewDimension: 'cube' } });
            entries.group.push({ binding, resource: this.getConnectionValue('envGGX').texture.createView({ dimension: 'cube' }) });

            //envCharlie
            bindGroupLocations.envCharlie = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, texture: { viewDimension: 'cube' } });
            entries.group.push({ binding, resource: this.getConnectionValue('envCharlie').texture.createView({ dimension: 'cube' }) });
        }

        this.punctual = this.getConnectionValue('punctual');
        if(this.punctual) {
            //punctual
            bindGroupLocations.punctual = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT | SHADER_STAGE.VERTEX, buffer:  { } });
            entries.group.push({ binding, resource: { buffer: this.punctual.buffer } });
        }

        if(this.getConnectionValue('shadows')) {
            //shadowSampler
            bindGroupLocations.shadowsSampler = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, sampler: { type: 'comparison'} });
            entries.group.push({ binding, resource: this.getConnectionValue('shadowsSampler') });

            //shadowTexture
            bindGroupLocations.shadowsTexture = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, texture: { viewDimension: '2d-array', sampleType: 'depth' } });
            entries.group.push({ binding, resource: this.getConnectionValue('shadows').texture.createView({ dimension: '2d-array', arrayLayerCount: 6 }) });
        }

        if(this.getConnectionValue('transmission')) {
            //transmissionSampler
            bindGroupLocations.transmissionSampler = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, sampler: { } });
            entries.group.push({ binding, resource: this.gal.device.createSampler({ minFilter: 'linear', magFilter: 'linear', mipmapFilter: 'linear' }) });

            //transmissionTexture
            bindGroupLocations.transmissionTexture = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, texture: { } });
            entries.group.push({ binding, resource: this.getConnectionValue('transmission').texture.createView() });
        }

        if(this.getConnectionValue('ssao')) {
            //ssaoSampler
            bindGroupLocations.ssaoSampler = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, sampler: { } });
            entries.group.push({ binding, resource: this.gal.device.createSampler({ minFilter: 'nearest', magFilter: 'nearest' }) });

            //ssaoTexture
            bindGroupLocations.ssaoTexture = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, texture: { } });
            entries.group.push({ binding, resource: this.getConnectionValue('ssao')?.texture.createView() });
        }

        return { entries, bindGroupLocations };
    }

    async precompile(graph) {
        const { opaque, transmissive, alpha } = graph.instances;
        await Promise.all([...opaque, ...transmissive, ...alpha].map(({ primitive, frontFace }) => {
            const material = graph.getActiveMaterial(primitive);
            return this.getShader({ primitive, material, frontFace }).compiled;
        }));
    }

}

export default GLTFNode;
