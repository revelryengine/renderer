import { ColorAttachment, DepthAttachment, RenderNode } from '../../render-node.js';

import { GridShader } from '../shaders/grid-shader.js';

import { NonNull } from '../../../../deps/utils.js';

/**
 * The Grid Node is responsible for drawing the reference grid.
 */
export class GridNode extends RenderNode {
    /**
     *
     * @param {{ color: ColorAttachment, depth: DepthAttachment}} config
     */
    reconfigure({ color, depth }) {
        super.reconfigure();
        this.color = color;
        this.depth = depth;

        this.gridShader = new GridShader(this.gal, { settings: this.renderPath.settings }).compile();

        return {};
    }

    /**
     * @type {RenderNode['begin']}
     */
    begin(commandEncoder) {
        return commandEncoder.beginRenderPass({
            label: this.constructor.name,
            colorAttachments: [
                {
                    view    : NonNull(this.color?.texture).createView(),
                    storeOp : 'store',
                    loadOp  : 'load',
                }
            ],
            depthStencilAttachment: {
                view           : NonNull(this.depth?.texture).createView(),
                depthStoreOp   : 'store',
                depthLoadOp    : 'load',
            }
        });
    }

    /**
     * @type {RenderNode['render']}
     */
    render(renderPassEncoder) {
        const  { graph, frustum } = this.passData;
        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        renderPassEncoder.setBindGroup(1, frustum.bindGroup);
        this.gridShader?.run(renderPassEncoder);
    }
}
