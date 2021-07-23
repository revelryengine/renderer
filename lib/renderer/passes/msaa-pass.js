import { RenderPass    } from './render-pass.js';

/**
 * The MSAA Pass is responsible for rendering the previous pass' framebuffer to the output framebuffer.
 * The previous framebuffer must have a multisampled color texture and depth attachment.
 * The previous pass must also have the same scale factor.
 */
export class MSAAPass extends RenderPass {
    static output = {
        scaleFactor: 1,
        textures: [
            { name: 'color' , type: 'color' },
        ],
    }

    render(graph) {
        this.blitFramebuffer(graph.passes[RenderPass.previous], this.output);
        return this.output;
    }
}

export default MSAAPass;