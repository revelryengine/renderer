import { Program } from './program.js';

import { vertexShader   } from '../shaders/simple.vert.js';
import { fragmentShader } from '../shaders/gaussian.frag.js';

export class GaussianProgram extends Program {
    static vertexShaderSrc = vertexShader;
    static fragmentShaderSrc = fragmentShader;

    constructor(context, graph, { direction, bilateral }) {
        const overrides =  {};
        if (direction === 'horizontal') overrides.DIRECTION_HORIZONTAL = 1;
        if (bilateral) overrides.BILATERAL = 1;
        super(context, overrides);
    }

    run(graph, input) {
        super.run();

        const { context: gl } = this;

        this.uniforms.set('u_InputSampler', input.color.glTexture);

        this.update();

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 3);
    }
}

export default GaussianProgram;