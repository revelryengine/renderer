import { Program } from './program.js';

import { vertexShader   } from '../shaders/simple.vert.js';
import { fragmentShader } from '../shaders/blur.frag.js';
import { RenderPass     } from '../passes/render-pass.js';

/**
 * Previous pass must output a texture named `color`.
 */
export class BlurProgram extends Program {
    static vertexShaderSrc = vertexShader;
    static fragmentShaderSrc = fragmentShader;

    constructor(context) {
        super(context, {});
    }

    run(graph) {
        super.run();

        const { context: gl } = this;

        this.uniforms.set('u_InputSampler', graph.passes[RenderPass.previous].textures.color);
        this.uniforms.set('u_BlurSize', 4);

        this.update();

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 3);
    }
}

export default BlurProgram;