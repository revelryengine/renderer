import { TEXTURE_USAGE  } from '../constants.js';
import { ResampleShader } from '../shaders/resample-shader.js';
import { RenderNode     } from './render-node.js';

/**
 * The Output Node is responsible for outputing the results to the canvas. 
 */
export class OutputNode extends RenderNode {
    reconfigure() {
        super.reconfigure();
        
        const { gal, width, height } = this.renderPath;

        const { texture } = this.getConnectionValue('color');

        this.outputShader = new ResampleShader(this.gal, { view: texture.createView(), format: gal.presentationFormat });

        this.texture = gal.device.createTexture({
            size: { width, height },
            format: gal.presentationFormat,
            usage: TEXTURE_USAGE.RENDER_ATTACHMENT,
        });
    }

    begin(commandEncoder) {
        return commandEncoder.beginRenderPass({
            label: 'Node: OutputNode',
            colorAttachments: [{
                view: this.gal.getContextView(),
                loadValue: [0, 0, 0, 0],
            }],
        });
    }

    render(renderPassEncoder) {
        this.outputShader.run(renderPassEncoder);
    }
}

export default OutputNode;