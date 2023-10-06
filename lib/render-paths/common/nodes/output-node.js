import { RenderNode } from './render-node.js';

import { OutputShader } from '../shaders/output-shader.js';

/**
 * The Output Node is responsible for outputing the results to the canvas. 
 */
export class OutputNode extends RenderNode {
    reconfigure() {
        super.reconfigure();
        const view   = this.getConnectionValue('color').texture.createView();
        const format = this.gal.presentationFormat;
        this.outputShader = new OutputShader(this.gal, { label: 'OutputNode', view, format }).compile();
    }

    begin(commandEncoder) {
        return commandEncoder.beginRenderPass({
            label: this.constructor.name,
            colorAttachments: [{
                view: this.gal.getContextView(),
                clearValue: [0, 0, 0, 0],
                storeOp: 'store',
                loadOp: 'clear',
            }],
        });
    }

    render(renderPassEncoder, { frustum }) {
        renderPassEncoder.setViewport(frustum.viewport.x, frustum.viewport.y, frustum.width, frustum.height, 0, 1);
        renderPassEncoder.setBindGroup(0, frustum.bindGroup);
        this.outputShader.run(renderPassEncoder);
    }
}

export default OutputNode;