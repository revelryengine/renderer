import { RenderNode } from '../../render-node.js';

import { CoCShader  } from '../shaders/coc-shader.js';
import { LensShader } from '../shaders/lens-shader.js';

class CoCNode extends RenderNode {
    scaleFactor = 1.0;

    attachments = {
        colors: {
            color: { location: 0 }
        }
    }

    reconfigure({ depth }) {
        super.reconfigure();
        this.cocShader = new CoCShader(this.gal, { settings: this.renderPath.settings, depth }).compile();
    }

    render(renderPassEncoder, { graph, frustum }) {
        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        renderPassEncoder.setBindGroup(1, frustum.bindGroup);
        this.cocShader.run(renderPassEncoder);
    }
}

/**
 * The Lens Node is a post process node responsible for rendering physical lens properties to the image.
 */
export class LensNode extends RenderNode {
    attachments = {
        colors: {
            color: { location: 0 },
        },
    }

    constructor(renderPath) {
        super(renderPath);
        this.cocNode  = new CoCNode(renderPath);
    }

    reconfigure({ color, depth }) {
        super.reconfigure();

        this.cocNode.reconfigure({ depth });

        this.lensShader = new LensShader(this.gal, { color, coc: this.cocNode.output.color }).compile();

        return { color: this.output.color };
    }

    run(commandEncoder, { graph, frustum }) {
        this.cocNode.run(commandEncoder, { graph, frustum });
        super.run(commandEncoder, { graph, frustum });
    }

    render(renderPassEncoder, { graph, frustum }) {
        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        renderPassEncoder.setBindGroup(1, frustum.bindGroup);
        this.lensShader.run(renderPassEncoder, { graph, frustum });
    }

    destroy() {
        this.cocNode.destroy();
        super.destroy();
    }
}

export default LensNode;
