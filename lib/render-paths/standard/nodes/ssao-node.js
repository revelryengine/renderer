import { ColorAttachment, RenderNode } from '../../render-node.js';

import { GaussianNode } from '../../common/nodes/gaussian-node.js';

import { SSAOShader } from '../shaders/ssao-shader.js';

class SSAOBlurNode extends GaussianNode {
    scaleFactor = 0.5;
}

/**
 * The SSAO Node is responsible for generating a screen space ambient occlusion texture from the Base Node
 *
 * @extends {RenderNode<{
 *  input: {
 *    point: ColorAttachment<'rgba32float'>,
 *  }
 * }>}
 */
export class SSAONode extends RenderNode {
    attachments = {
        colors: {
            color: new ColorAttachment({ format: 'r8unorm' }),
        },
    }

    scaleFactor = 0.5;

    blurNode = new SSAOBlurNode(this.renderPath, { passes: 3, bilateral: true });

    /**
     * @type {RenderNode['render']}
     */
    render(renderPassEncoder) {
        const  { graph, frustum } = this.passData;

        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        renderPassEncoder.setBindGroup(1, frustum.bindGroup);
        this.shader?.run(renderPassEncoder);
    }

    /**
     * @type {RenderNode['run']}
     */
    run(commandEncoder) {
        super.run(commandEncoder);
        this.blurNode.run(commandEncoder);
    }

    /**
     * @this {this & { settings: import('../standard-settings.js').StandardSettings }}
     */
    reconfigure() {
        super.reconfigure();

        this.blurNode.reconfigure({ input: this.attachments.colors.color });

        this.shader = new SSAOShader(this.gal, { settings: this.settings, point: this.input['point'], size: this.getTargetSize() }).compile();

        this.output.color = this.blurNode.output.color;
    }

    destroy() {
        this.blurNode.destroy();
        super.destroy();
    }
}
