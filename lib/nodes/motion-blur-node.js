import { MotionBlurShader } from '../shaders/motion-blur-shader.js';
import { RenderNode       } from './render-node.js';

/**
 * The Motion Blur Node is responsible for applying motion blur. 
 */
export class MotionBlurNode extends RenderNode {
    attachments = {
        colors: [
            { name: 'color' },
        ],
    }

    reconfigure({ color, motion }) {
        super.reconfigure();

        this.blurShader = new MotionBlurShader(this.gal, { color, motion });
        return { color: this.output.color };
    }

    render(renderPassEncoder, { graph, frustum }) {
        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        renderPassEncoder.setBindGroup(1, frustum.bindGroup);
        this.blurShader.run(renderPassEncoder);
    }
}

export default MotionBlurNode;