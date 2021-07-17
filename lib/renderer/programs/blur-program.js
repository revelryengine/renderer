import { Program } from './program.js';

import vertexShader from '../shaders/simple.vert.js';
import fragmentShader from '../shaders/blur.frag.js';

export class BlurProgram extends Program {
    static vertexShaderSrc = vertexShader;
    static fragmentShaderSrc = fragmentShader;

    constructor(context, { input }) {
        super(context, { });
        this.input = input;
    }

    run() {
        super.run();

        const { context: gl } = this;

        this.uniforms.set('u_InputSampler', this.input);
        this.uniforms.set('u_BlurSize', 4);

        this.update();

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 3);
    }
}

export default BlurProgram;