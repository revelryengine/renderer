import { RenderNode } from '../../common/nodes/render-node.js';

import { GLTFShader, GLTFAlphaCompositeShader } from '../shaders/gltf-shader.js';

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

    renderBlock(renderPassEncoder, graph, buffer, { primitive, mesh, skin, offset, count, frontFace }) {
        const material = graph.getActiveMaterial(primitive);
        const shader   = this.getShader({ primitive, mesh, material, skin, frontFace });
        shader.run(renderPassEncoder, { buffer, offset, count });
    }

    renderOpaque(renderPassEncoder, { graph, instances }) {
        for(const block of instances.blocks.opaque) {
            this.renderBlock(renderPassEncoder, graph, instances.buffer, block);
        }
    }

    renderTransmissive(renderPassEncoder, { graph, instances }) {
        for(const block of instances.blocks.transmissive) {
            this.renderBlock(renderPassEncoder, graph, instances.buffer, block);
        }
    }

    renderAlpha(renderPassEncoder, { graph, instances }) {
        for(const block of instances.blocks.alpha) {
            this.renderBlock(renderPassEncoder, graph, instances.buffer, block);
        }
    }

    #shaders = new WeakMap();
    getShader({ primitive, mesh, material, frontFace }) {
        const key = this.Shader.getShaderKey(primitive, material, frontFace);
        return this.#shaders.get(key) ?? this.#shaders.set(key, new this.Shader(this.gal, { 
            primitive, mesh, material, frontFace, settings: this.settings,
            renderNode: this, sampleCount: this.sampleCount
        })).get(key);
    }

    clearShaderCache() {
        this.#shaders = new WeakMap();
    }

    #alphaComposite;
    reconfigure() {
        super.reconfigure();

        const { alphaBlendMode } = this.settings;

        const { alpha, attachments: { colors: { color, accum, reveal } } } = this;

        if(alpha && alphaBlendMode === 'weighted' && (color && (color.enabled ?? true))) {
            this.#alphaComposite = {
                shader:  new GLTFAlphaCompositeShader(this.gal, { accum, reveal }),
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
}

export default GLTFNode;