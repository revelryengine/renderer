import { SimpleShader  } from '../shaders/simple-shader.js';
import { RenderNode    } from './render-node.js';

/**
 * The Simple Node is only used for debugging purposes. This node is akin to a hello world render node.
 */
export class SimpleNode extends RenderNode {
    attachments = {
        colors: { 
            color: { location: 0 },
        },
    }

    reconfigure() {
        super.reconfigure();
        this.shader = new SimpleShader(this.gal);
    }

    render(renderPassEncoder, { graph, frustum }) {
        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        renderPassEncoder.setBindGroup(1, frustum.bindGroup);

        this.shader.run(renderPassEncoder);
    }

}

export default SimpleNode;