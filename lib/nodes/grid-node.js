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
        return { color, depth };
    }


    begin(commandEncoder) {
        return commandEncoder.beginRenderPass({ 
            label: 'Node: GridNode',
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
                stencilStoreOp : 'store',
                stencilLoadOp  : 'load',          
            }
        });
    }

    render(renderPassEncoder, { graph, frustum }) {
        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        renderPassEncoder.setBindGroup(1, frustum.bindGroup);
        if(this.renderPath.settings.grid?.enabled){
            this.gridShader.run(renderPassEncoder);
        }
        
    }
}

export default GridNode;