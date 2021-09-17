import { Program } from './program.js';

import { vertexShader   } from '../shaders/simple.vert.js';
import { fragmentShader } from '../shaders/gaussian.frag.js';

export class GaussianProgram extends Program {
    static vertexShaderSrc   = vertexShader;
    static fragmentShaderSrc = fragmentShader;

    constructor(context, { direction, bilateral, defines = {} }) {
        defines =  {
            DIRECTION_HORIZONTAL: direction === 'horizontal' ? 1 : null,
            BILATERAL: bilateral ? 1: null,
            ...defines,
        };
        super(context, { defines });
    }

    run({ input }) {
        super.run();

        const { context: gl } = this;

        this.samplers.set('u_InputSampler', input.color.glTexture);

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 3);
    }
}

export default GaussianProgram;