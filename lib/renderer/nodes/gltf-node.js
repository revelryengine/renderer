import { RenderNode  } from './render-node.js';
import { GLTFProgram } from '../programs/gltf-program.js';

/**
 * The GLTF Node is responsible for rendering the full output as defined by the glTF spec.
 */
export class GLTFNode extends RenderNode {
    static type = 'geometry';

    static program = GLTFProgram;

    static multisample = true;

    static input = {
        ssao:         { type: 'texture' },
        transmission: { type: 'texture' },
    }

    static output = {
        color:  { type: 'texture', attachmentType: 'color' },
        depth:  { type: 'texture', attachmentType: 'depth' },
    }
}

export default GLTFNode;