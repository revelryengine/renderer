import { RenderNode  } from './render-node.js';
import { GLTFProgram } from '../programs/gltf-program.js';

/**
 * The GLTF Node is responsible for rendering the full output as defined by the glTF spec.
 */
export class GLTFNode extends RenderNode {
    type = 'geometry';

    program = GLTFProgram;

    multisample = true;

    textures = [
        { name: 'color', type: 'color' },
        { name: 'depth', type: 'depth' },
    ]

    input = {
        ssao:         { type: 'texture' },
        transmission: { type: 'texture' },
    }

    output = {
        color: { type: 'texture' },
        ids:   { type: 'texture' },
        z:     { type: 'texture' },
        depth: { type: 'texture' },
        
    }
}

export default GLTFNode;