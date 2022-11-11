import { GaussianNode } from './gaussian-node.js';
import { RenderNode   } from './render-node.js';
import { SSAOShader   } from '../shaders/ssao-shader.js';

class SSAOBlurNode extends GaussianNode {
    scaleFactor = 0.5;
}

/**
 * The SSAO Node is responsible for generating a screen space ambient occlusion texture from the Base Node 
 */
export class SSAONode extends RenderNode {
    attachments = {
        colors: [
            { name: 'color', format: 'r8unorm' }
        ],
    }

    scaleFactor = 0.5;

    constructor(renderPath) {
        super(renderPath);

        this.blurNode = new SSAOBlurNode(renderPath, { passes: 3, bilateral: true });
    }

    render(renderPassEncoder, { graph, frustum }) {
        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        renderPassEncoder.setBindGroup(1, frustum.bindGroup);
        this.shader.run(renderPassEncoder);
    }

    run(commandEncoder, { graph, frustum }) {
        super.run(commandEncoder, { graph, frustum });
        this.blurNode.run(commandEncoder, { graph, frustum });
    }

    reconfigure() {
        super.reconfigure();

        this.blurNode.reconfigure({ input: this.attachments.colors[0] });

        this.shader = new SSAOShader(this.gal, { point: this.getConnectionValue('point'), size: this.getTargetSize() });

        this.output.color = this.blurNode.output.color;

    }

    destroy() {
        this.blurNode.destroy();
        super.destroy();
    }
}

export default SSAONode;