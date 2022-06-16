import { CoCShader    } from '../shaders/coc-shader.js';
import { LensShader   } from '../shaders/lens-shader.js';
import { RenderNode   } from './render-node.js';

class CoCNode extends RenderNode {
    scaleFactor = 1.0;

    attachments = {
        colors: [
            { name: 'color' },
        ],
    }
    
    reconfigure({ depth }) {
        super.reconfigure();
        this.cocShader = new CoCShader(this.gal, { depth });
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
        colors: [
            { name: 'color' },
        ],
    }

    constructor(renderPath) {
        super(renderPath);
        this.cocNode  = new CoCNode(renderPath);
    }

    reconfigure({ color, depth }) {
        if (this.renderPath.settings.lens?.enabled) {
            super.reconfigure();

            this.color = color;
            this.depth = depth;

            this.cocNode.reconfigure({ depth });

            this.lensShader = new LensShader(this.gal, { color, coc: this.cocNode.output.color });

            return { color: this.output.color, depth };
        }

        return { color, depth };
    }

    resize(...args){
        // if (this.renderPath.settings.lens?.enabled) {
            super.resize(...args);
            this.cocNode.resize(...args);
        //}
    }

    run(commandEncoder, { graph, frustum }) {
        if (this.renderPath.settings.lens?.enabled) {
            this.cocNode.run(commandEncoder, { graph, frustum });
            super.run(commandEncoder, { graph, frustum });
        }
    }

    render(renderPassEncoder, { graph, frustum }) {
        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        renderPassEncoder.setBindGroup(1, frustum.bindGroup);
        this.lensShader.run(renderPassEncoder, { graph, frustum });
    }
}

export default LensNode;