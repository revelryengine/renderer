import { RenderPass } from './render-pass.js';
import { MSAAPass   } from './msaa-pass.js';
import { PBRProgram } from '../programs/pbr-program.js';

/**
 * The PBR Pass is responsible for rendering the full PBR output as defined by the glTF spec.
 */
export class PBRPass extends RenderPass {
    static type = 'geometry';

    static program = PBRProgram;

    static output = {
        scaleFactor: 1,
        textures: [
            { name: 'color', type: 'color' },
            { name: 'depth', type: 'depth' },
        ],
        multisample: true,
    }

    postprocess = [
        new MSAAPass(`${this.name}:msaa`, this.context),
    ];
}

export default PBRPass;