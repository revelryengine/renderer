import { ColorAttachment, RenderNode } from '../../render-node.js';

import { MotionBlurShader } from '../shaders/motion-blur-shader.js';

/**
 * The Motion Blur Node is responsible for applying motion blur.
 */
export class MotionBlurNode extends RenderNode {
    attachments = {
        colors: {
            color: new ColorAttachment({ format: 'rgba8unorm'}),
        },
    }

    /**
     * @param {{ color: ColorAttachment, motion: ColorAttachment }} config
     */
    reconfigure({ color, motion }) {
        super.reconfigure();

        this.blurShader = new MotionBlurShader(this.gal, { settings: this.renderPath.settings, color, motion }).compile();
        return { color: this.output.color };
    }

    /**
     * @type {RenderNode['render']}
     */
    render(renderPassEncoder) {
        const { graph, frustum } = this.passData;
        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        renderPassEncoder.setBindGroup(1, frustum.bindGroup);
        this.blurShader?.run(renderPassEncoder);
    }
}
