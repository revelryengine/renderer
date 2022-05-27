import { ResampleShader } from '../shaders/resample-shader.js';
import { RenderNode     } from './render-node.js';

/**
 * The Output Node is responsible for outputing the results to the canvas. 
 */
export class OutputNode extends RenderNode {
    reconfigure() {
        super.reconfigure();
        const view   = this.getConnectionValue('color').texture.createView();
        const format = this.gal.presentationFormat;
        this.outputShader = new ResampleShader(this.gal, { view, format });
    }

    begin(commandEncoder) {
        return commandEncoder.beginRenderPass({
            label: 'Node: OutputNode',
            colorAttachments: [{
                view: this.gal.getContextView(),
                clearValue: [0, 0, 0, 0],
                storeOp: 'store',
                loadOp: 'clear',
            }],
            
        });
    }

    render(renderPassEncoder) {
        this.outputShader.run(renderPassEncoder);
    }
}

export default OutputNode;