import { GridShader    } from '../shaders/grid-shader.js';
import { RenderNode    } from './render-node.js';

/**
 * The Grid Node is responsible for drawing the reference grid. 
 */
export class GridNode extends RenderNode {
    reconfigure({ color, depth }) {
        super.reconfigure();
        this.color = color;
        this.depth = depth;

        this.gridShader = new GridShader(this.gal);
    }

    begin(commandEncoder) {
        return commandEncoder.beginRenderPass({ 
            label: this.constructor.name,
            colorAttachments: [
                {
                    view    : this.color.texture.createView(),
                    storeOp : 'store',
                    loadOp  : 'load',
                }
            ],
            depthStencilAttachment: {
                view           : this.depth.texture.createView(),
                depthStoreOp   : 'store',
                depthLoadOp    : 'load',       
            }
        });
    }

    render(renderPassEncoder, { graph, frustum }) {
        renderPassEncoder.setViewport(...frustum.uniformViewport);
        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        renderPassEncoder.setBindGroup(1, frustum.bindGroup);
        this.gridShader.run(renderPassEncoder);
    }
}

export default GridNode;