import { ColorAttachment, RenderNode } from '../../render-node.js';

import { PoissonShader } from '../shaders/poisson-shader.js';

/**
 * The PoissonNode is responsible for applying a poisson disc blur.
 */
export class PoissonNode extends RenderNode {
    attachments = {
        colors: {
            color: new ColorAttachment(),
        },
    }

    /**
     * @param {{ input: ColorAttachment }} config
     */
    reconfigure({ input }) {
        super.reconfigure();
        this.shader = new PoissonShader(this.gal, { color: input }).compile();
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
