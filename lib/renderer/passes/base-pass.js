import { RenderPass  } from './render-pass.js';
import { BaseProgram } from '../programs/base-program.js';

/**
 * The Base Pass is responsible for capturing the linear output of all opaque objects along with depth and normals.
 */
export class BasePass extends RenderPass {
    static type = 'geometry';
    static opaque = true;

    static program = BaseProgram;

    static output = {
        scaleFactor: 0.5, powerOf2: true,
        textures: [
            { name: 'color' , type: 'color', mipmaps: true },
            { name: 'normal', type: 'color', mipmaps: true },
            { name: 'depth',  type: 'depth' },
        ],
    }
}

export default BasePass;