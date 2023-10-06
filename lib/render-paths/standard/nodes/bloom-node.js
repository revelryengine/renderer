import { RenderNode   } from '../../common/nodes/render-node.js';
import { GaussianNode } from '../../common/nodes/gaussian-node.js';

import { BloomShader  } from '../shaders/bloom-shader.js';

class BloomBlurNode extends GaussianNode {
    scaleFactor = 0.5;
    passes = 3;
}

class BloomExtractNode extends RenderNode {
    scaleFactor = 0.5;
    attachments = {
        colors: { 
            color: { location: 0 },
        },
    }
    
    reconfigure({ color }) {
        super.reconfigure();
        this.bloomShader = new BloomShader(this.gal, { color }).compile();
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
        colors: { 
            color: { location: 0 },
        },
    }

    extractNode = new BloomExtractNode(this.renderPath);   
    blurNode    = new BloomBlurNode(this.renderPath);

    reconfigure({ color }) {
        super.reconfigure();

        this.extractNode.reconfigure({ color });
        this.blurNode.reconfigure({ input: this.extractNode.output.color });

        this.bloomShader = new BloomShader(this.gal, { color, bloom: this.blurNode.output.color, mode: 'mix' }).compile();

        return { color: this.output.color };
    }

    run(commandEncoder, { graph, frustum }) {
        this.extractNode.run(commandEncoder, { graph, frustum });
        this.blurNode.run(commandEncoder, { graph, frustum });
        super.run(commandEncoder, { graph, frustum });
    }

    render(renderPassEncoder, { graph, frustum }) {
        renderPassEncoder.setViewport(...frustum.uniformViewport);
        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        renderPassEncoder.setBindGroup(1, frustum.bindGroup);
        this.bloomShader.run(renderPassEncoder);
    }

    destroy() {
        this.extractNode.destroy();
        this.blurNode.destroy();
        super.destroy();
    }
}

export default BloomNode;