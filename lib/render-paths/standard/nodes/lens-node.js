import { ColorAttachment, DepthAttachment, RenderNode } from '../../render-node.js';

import { CoCShader  } from '../shaders/coc-shader.js';
import { LensShader } from '../shaders/lens-shader.js';

class CoCNode extends RenderNode {
    scaleFactor = 1.0;

    attachments = {
        colors: {
            color: new ColorAttachment(),
        }
    }

    /**
     * @param {{ depth: DepthAttachment }} config
     */
    reconfigure({ depth }) {
        super.reconfigure();
        this.cocShader = new CoCShader(this.gal, { settings: this.renderPath.settings, depth }).compile();
    }

    /**
     * @type {RenderNode['render']}
     */
    render(renderPassEncoder) {
        const { graph, frustum } = this.passData;
        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        renderPassEncoder.setBindGroup(1, frustum.bindGroup);
        this.cocShader?.run(renderPassEncoder);
    }
}

/**
 * The Lens Node is a post process node responsible for rendering physical lens properties to the image.
 */
export class LensNode extends RenderNode {
    attachments = {
        colors: {
            color: new ColorAttachment(),
        },
    }

    cocNode = new CoCNode(this.renderPath)

    /**
     * @param {{ color: ColorAttachment, depth: DepthAttachment }} config
     */
    reconfigure({ color, depth }) {
        super.reconfigure();

        this.cocNode.reconfigure({ depth });

        this.lensShader = new LensShader(this.gal, { color, coc: this.cocNode.output.color }).compile();

        return { color: this.output.color };
    }

    /**
     * @type {RenderNode['run']}
     */
    run(commandEncoder) {
        this.cocNode.run(commandEncoder);
        super.run(commandEncoder);
    }

    /**
     * @type {RenderNode['render']}
     */
    render(renderPassEncoder) {
        const { graph, frustum } = this.passData;
        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        renderPassEncoder.setBindGroup(1, frustum.bindGroup);
        this.lensShader?.run(renderPassEncoder);
    }

    destroy() {
        this.cocNode.destroy();
        super.destroy();
    }
}
