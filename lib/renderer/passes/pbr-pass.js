import { RenderPass } from './render-pass.js';
import { PBRProgram } from '../programs/pbr-program.js';

/**
 * The PBR Pass is responsible for rendering the full PBR output as defined by the glTF spec.
 */
export class PBRPass extends RenderPass {
    static type = 'geometry';

    static program = PBRProgram;

    static output = {
        scaleFactor: 1, powerOf2: false,
        textures: [
            { name: 'color', type: 'color', mipmaps: true },
            { name: 'depth', type: 'depth' },
        ],
        multisample: true,
    }
}

export default PBRPass;