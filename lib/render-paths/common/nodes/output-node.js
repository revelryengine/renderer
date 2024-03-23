import { ColorAttachment, RenderNode } from '../../render-node.js';

import { OutputShader } from '../shaders/output-shader.js';

import { NonNull } from '../../../../deps/utils.js';

/**
 * The Output Node is responsible for outputing the results to the canvas.
 *
 * @extends {RenderNode<{
 *  input: {
 *      color: ColorAttachment<'rgba8snorm'>,
 *  },
 *  settings: import('../../render-path-settings.js').RenderPathSettings,
 * }>}
 */
export class OutputNode extends RenderNode {
    reconfigure() {
        super.reconfigure();
        const view   = NonNull(this.input['color'].texture).createView();
        const format = this.gal.presentationFormat;
        this.outputShader = new OutputShader(this.gal, { view, format }).compile();
    }

    /**
     * @type {RenderNode['begin']}
     */
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

    /**
     * @type {RenderNode['render']}
     */
    render(renderPassEncoder) {
        const { frustum } = this.passData;
        renderPassEncoder.setViewport(0, 0, frustum.width, frustum.height, 0, 1);
        renderPassEncoder.setBindGroup(0, frustum.bindGroup);
        this.outputShader?.run(renderPassEncoder);
    }
}
