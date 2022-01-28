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
            colorAttachments: [
                {
                    view      : this.color.texture.createView(),
                    storeOp   : 'store',
                    loadValue : 'load',
                }
            ],
            depthStencilAttachment: {
                view             : this.depth.texture.createView(),
                depthStoreOp     : 'store',
                depthLoadValue   : 'load',
                stencilStoreOp   : 'store',
                stencilLoadValue : 'load',                
            }
        });
    }

    render(renderPassEncoder, { frustum }) {
        renderPassEncoder.setBindGroup(0, frustum.bindGroup);
        if(this.renderPath.settings.grid?.enabled){
            this.gridShader.run(renderPassEncoder, this.renderPath.settings.grid);
        }
        
    }
}

export default GridNode;