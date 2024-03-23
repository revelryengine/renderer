import { ColorAttachment, RenderNode } from '../../render-node.js';

import { SimpleShader } from '../shaders/simple-shader.js';


/**
 * The Simple Node is only used for debugging purposes. This node is akin to a hello world render node.
 */
export class SimpleNode extends RenderNode {
    attachments = {
        colors: {
            color: new ColorAttachment(),
        },
    }

    reconfigure() {
        super.reconfigure();
        this.shader = new SimpleShader(this.gal, {}).compile();
    }


    /**
     * @type {RenderNode['render']}
     */
    render(renderPassEncoder) {
        const { graph, frustum } = this.passData;

        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        renderPassEncoder.setBindGroup(1, frustum.bindGroup);

        this.shader?.run(renderPassEncoder);
    }
}
