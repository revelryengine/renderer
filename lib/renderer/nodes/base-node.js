import { RenderNode  } from './render-node.js';
import { BaseProgram } from '../programs/base-program.js';

/**
 * The Base Node is responsible for capturing the linear output of all opaque objects along with depth and normals. 
 */
export class BaseNode extends RenderNode {
    type = 'geometry';
    opaque = true;

    program = BaseProgram;

    scaleFactor = 0.5;

    textures = [
        { name: 'color',  type: 'color' },
        { name: 'normal', type: 'color' },
        { name: 'depth',  type: 'depth' },
    ]

    output = {
        color:    { type: 'texture' },
        normal:   { type: 'texture' },
        depth:    { type: 'texture' },
    }
}

export default BaseNode;