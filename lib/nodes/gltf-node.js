import { RenderNode } from './render-node.js';
import { GLTFShader } from '../shaders/gltf-shader.js';

export class GLTFNode extends RenderNode {
    Shader = GLTFShader;

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
        return this.#shaders.get(key) || this.#shaders.set(key, new this.Shader(this.gal, { 
            primitive, mesh, material, frontFace, settings: this.renderer.settings,
            renderNode: this, basePass: this.basePass, sampleCount: this.sampleCount
        })).get(key);
    }

    clearShaderCache() {
        this.#shaders = new WeakMap();
    }
}

export default GLTFNode;