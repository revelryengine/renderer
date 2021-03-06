import { BloomShader  } from '../shaders/bloom-shader.js';
import { GaussianNode } from './gaussian-node.js';
import { RenderNode   } from './render-node.js';

class BloomBlurNode extends GaussianNode {
    scaleFactor = 0.5;
    passes = 5;
}

class BloomExtractNode extends RenderNode {
    attachments = {
        colors: [
            { name: 'color' },
        ],
    }
    
    reconfigure({ color }) {
        super.reconfigure();
        this.bloomShader = new BloomShader(this.gal, { color });
    }

    render(renderPassEncoder, { graph, frustum }) {
        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        renderPassEncoder.setBindGroup(1, frustum.bindGroup);
        this.bloomShader.run(renderPassEncoder);
    }
}

/**
 * The Bloom Node is a post process node responsible for rendering a bloom effect.
 */
export class BloomNode extends RenderNode {
    attachments = {
        colors: [
            { name: 'color' },
        ],
    }

    constructor(renderPath) {
        super(renderPath);

        this.extractNode = new BloomExtractNode(renderPath);   
        this.blurNode    = new BloomBlurNode(renderPath);
    }

    reconfigure({ color, depth }) {
        if (this.renderPath.settings.bloom?.enabled) {
            super.reconfigure();

            this.extractNode.reconfigure({ color });
            this.blurNode.reconfigure({ input: this.extractNode.output.color });

            this.bloomShader = new BloomShader(this.gal, { color, bloom: this.blurNode.output.color, mode: 'mix' });

            return { color: this.output.color, depth };
        }

        return { color, depth };
    }

    resize(...args){
        super.resize(...args);
        this.extractNode.resize(...args);
        this.blurNode.resize(...args);
    }

    run(commandEncoder, { graph, frustum }) {
        if (this.renderPath.settings.bloom?.enabled) {
            this.extractNode.run(commandEncoder, { graph, frustum });
            this.blurNode.run(commandEncoder, { graph, frustum });
            super.run(commandEncoder, { graph, frustum });
        }
    }

    render(renderPassEncoder, { graph, frustum }) {
        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        renderPassEncoder.setBindGroup(1, frustum.bindGroup);
        this.bloomShader.run(renderPassEncoder);
    }
}

export default BloomNode;