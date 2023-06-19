import { TEXTURE_USAGE } from '../constants.js';
import { TAAShader     } from '../shaders/taa-shader.js';
import { RenderNode    } from './render-node.js';

/**
 * The TAA Node is responsible for applying temporal anti-aliasing. 
 */
export class TAANode extends RenderNode {
    attachments = {
        colors: { 
            color: { location: 0 },
        },
    }

    reconfigure({ color, motion }) {
        super.reconfigure();


        const size = this.getTargetSize();
        const usage = TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_DST;

        this.history = this.gal.device.createTexture({ format: 'rgba8unorm', size, usage });

        this.taaShader = new TAAShader(this.gal, { color, history: this.history, motion });
        return { color: this.output.color };
    }

    render(renderPassEncoder, { graph, frustum }) {
        renderPassEncoder.setViewport(...frustum.uniformViewport);
        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        renderPassEncoder.setBindGroup(1, frustum.bindGroup);
        this.taaShader.run(renderPassEncoder);
    }

    run(commandEncoder, ...args) {
        super.run(commandEncoder, ...args);
        commandEncoder.copyTextureToTexture({ texture: this.output.color.texture }, { texture: this.history }, this.getTargetSize());
    }

    destroy() {
        this.history?.destroy();
    }
}

export default TAANode;