import { ColorAttachment, RenderNode   } from '../../render-node.js';
import { GaussianNode } from '../../common/nodes/gaussian-node.js';

import { BloomShader  } from '../shaders/bloom-shader.js';
import { NonNull } from '../../../../deps/utils.js';

class BloomBlurNode extends GaussianNode {
    scaleFactor = 0.5;
    passes = 3;
}

/**
 * @extends {RenderNode<{ settings: import('../standard-settings.js').StandardSettings }>}
 */
class BloomExtractNode extends RenderNode {
    scaleFactor = 0.5;
    attachments = {
        colors: {
            color: new ColorAttachment({ format: 'rgba8unorm' }),
        },
    }

    /**
     * @param {{ color: ColorAttachment<'rgba8unorm'> }} config
     */
    reconfigure({ color }) {
        super.reconfigure();
        this.bloomShader = new BloomShader(this.gal, { settings: this.settings, color }).compile();
    }

    /**
     * @type {RenderNode['render']}
     */
    render(renderPassEncoder) {
        const { graph, frustum } = this.passData;
        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        renderPassEncoder.setBindGroup(1, frustum.bindGroup);
        this.bloomShader?.run(renderPassEncoder);
    }
}

/**
 * The Bloom Node is a post process node responsible for rendering a bloom effect.
 * @extends {RenderNode<{ settings: import('../standard-settings.js').StandardSettings }>}
 */
export class BloomNode extends RenderNode {
    attachments = {
        colors: {
            color: new ColorAttachment(),
        },
    }

    extractNode = new BloomExtractNode(this.renderPath);
    blurNode    = new BloomBlurNode(this.renderPath);

    /**
     * @param {{ color: ColorAttachment<'rgba8unorm'> }} config
     */
    reconfigure({ color }) {
        super.reconfigure();

        this.extractNode.reconfigure({ color });
        this.blurNode.reconfigure({ input: NonNull(this.extractNode.output.color) });

        this.bloomShader = new BloomShader(this.gal, { settings: this.settings, color, bloom: this.blurNode.output.color, mode: 'mix' }).compile();

        return { color: this.output.color };
    }

    /**
     * @type {RenderNode['run']}
     */
    run(commandEncoder) {
        this.extractNode.run(commandEncoder);
        this.blurNode.run(commandEncoder);
        super.run(commandEncoder);
    }

    /**
     * @type {RenderNode['render']}
     */
    render(renderPassEncoder) {
        const { graph, frustum } = this.passData;

        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        renderPassEncoder.setBindGroup(1, frustum.bindGroup);
        this.bloomShader?.run(renderPassEncoder);
    }

    destroy() {
        this.extractNode.destroy();
        this.blurNode.destroy();
        super.destroy();
    }
}

