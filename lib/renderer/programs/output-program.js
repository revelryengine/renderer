import { Program } from './program.js';
import vertexShader from '../shaders/simple.vert.js';
import fragmentShader from '../shaders/output.frag.js';

export class OutputProgram extends Program {
    static vertexShaderSrc = vertexShader;
    static fragmentShaderSrc = fragmentShader;

    run({ input }) {
        const { context: gl } = this;

        super.run();

        const { color } = input;

        this.uniforms.set('u_OutputSampler', color.glTexture);

        this.update();

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}

export default OutputProgram;