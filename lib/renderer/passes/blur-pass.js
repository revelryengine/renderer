import { RenderPass  } from './render-pass.js';
import { BlurProgram } from '../programs/blur-program.js';

/**
 * The Blur Pass is responsible for blurring the previous pass
 * Previous pass must output a texture named `color`.
 */
export class BlurPass extends RenderPass {
    static type = 'screen';

    static program = BlurProgram;

    static output = {
        scaleFactor: 0.5, powerOf2: true,
        textures: [
            { name: 'color', type: 'color', mipmaps: true },
        ],
    }

    render(graph) {
        if(graph.passes[RenderPass.previous].skipped) return { skipped: true };
        return super.render(...arguments);
    }
}

export default BlurPass;