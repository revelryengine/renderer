import { RenderNode  } from './render-node.js';
import { InputProgram } from '../programs/input-program.js';

const GL = WebGL2RenderingContext;

/**
 * The Input Node is responsible for capturing output of all object ids along with depths for use with mouse/touch input. 
 */
export class InputNode extends RenderNode {
    type = 'geometry';

    program = InputProgram;

    scaleFactor = 0.5;

    textures = [
        { name: 'ids',   type: 'color', params: { min: GL.NEAREST, mag: GL.NEAREST, format: GL.RED, internalFormat: GL.R32F, type: GL.FLOAT } }, //
        { name: 'z',     type: 'color', params: { min: GL.NEAREST, mag: GL.NEAREST, format: GL.RED, internalFormat: GL.R32F, type: GL.FLOAT } },
        { name: 'depth', type: 'depth' },
    ]

    output = {
        ids:   { type: 'texture' },
        z:     { type: 'texture' },
        depth: { type: 'texture' }, // We need an actual depth buffer for depth testing but we will write depth to the z texture as well
    }
}

export default InputNode;