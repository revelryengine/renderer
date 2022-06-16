import { PoissonShader } from '../shaders/poisson-shader.js';
import { RenderNode    } from './render-node.js';

/**
 * The PoissonNode is responsible for applying a poisson disc blur.
 */
export class PoissonNode extends RenderNode {
    attachments = {
        colors: [
            { name: 'color' },
        ],
    }
        
    reconfigure({ input }) {
        super.reconfigure();
        this.shader = new PoissonShader(this.gal, { color: input });
    }

    render(renderPassEncoder, { graph, frustum  }) {
        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        renderPassEncoder.setBindGroup(1, frustum.bindGroup);
        this.shader.run(renderPassEncoder);
    }
}