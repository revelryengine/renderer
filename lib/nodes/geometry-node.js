import { RenderNode } from './render-node.js';
import { GLTFShader } from '../shaders/gltf-shader.js';

export class GeometryNode extends RenderNode {
    Shader = GLTFShader;

    render(renderPassEncoder, { graph, frustum, instances }) {
        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        renderPassEncoder.setBindGroup(1, frustum.bindGroup);
        renderPassEncoder.setBindGroup(2, this.bindGroup);

        const { blocks, buffer } = instances;

        for(const { primitive, mesh, skin, offset, count } of this.iterateBlocks(blocks)) {
            const material = graph.getActiveMaterial(primitive);
            const shader   = this.getShader({ primitive, mesh, material, skin });
            shader.run(renderPassEncoder, { buffer, offset, count });
        }
    }

    * iterateBlocks(blocks) {
        yield * blocks.opaque;
        yield * blocks.transmissive;
        yield * blocks.alpha;
    }

    #shaders = new WeakMap();
    getShader({ primitive, mesh, material }) {
        const key = this.Shader.getShaderKey(primitive, material);
        return this.#shaders.get(key) || this.#shaders.set(key, new this.Shader(this.gal, { 
            primitive, mesh, material, settings: this.renderPath.settings,
            nodeLayout: this.bindGroupLayout, basePass: this.basePass, multisample: this.sampleCount > 1 ? true : undefined
        })).get(key);
    }

    clearShaderCache() {
        this.#shaders = new WeakMap();
    }
}

export default GeometryNode;