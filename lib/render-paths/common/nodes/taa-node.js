import { TEXTURE_USAGE } from '../../../constants.js';

import { ColorAttachment, RenderNode } from '../../render-node.js';

import { TAAShader } from '../shaders/taa-shader.js';

import { NonNull } from '../../../../deps/utils.js';

/**
 * The TAA Node is responsible for applying temporal anti-aliasing.

 */
export class TAANode extends RenderNode {
    attachments = {
        colors: {
            color: new ColorAttachment(),
        },
    }

    /**
     * @param {{ color: ColorAttachment<'rgba8unorm'>, motion: ColorAttachment<'rg16float'> }} config
     */
    reconfigure({ color, motion }) {
        super.reconfigure();

        const size = this.getTargetSize();
        const usage = TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_DST;

        this.history = this.gal.device.createTexture({ format: 'rgba8unorm', size, usage });

        this.taaShader = new TAAShader(this.gal, { color, history: this.history, motion }).compile();
        return { color: this.output.color };
    }

    /**
     * @type {RenderNode['render']}
     */
    render(renderPassEncoder) {
        const { graph, frustum } = this.passData;

        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        renderPassEncoder.setBindGroup(1, frustum.bindGroup);
        this.taaShader?.run(renderPassEncoder);
    }

    /**
     * @type {RenderNode['run']}
     */
    run(commandEncoder) {
        super.run(commandEncoder);
        commandEncoder.copyTextureToTexture({ texture: NonNull(this.output.color?.texture) }, { texture: NonNull(this.history) }, this.getTargetSize());
    }

    destroy() {
        this.history?.destroy();
        super.destroy();
    }
}
