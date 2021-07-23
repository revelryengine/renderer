import { Program } from './program.js';

import { vertexShader   } from '../shaders/simple.vert.js';
import { fragmentShader } from '../shaders/gaussian.frag.js';
import { RenderPass     } from '../passes/render-pass.js';

/**
 * Previous pass must output a texture named `color`.
 */
export class GaussianProgram extends Program {
    static vertexShaderSrc = vertexShader;
    static fragmentShaderSrc = fragmentShader;

    constructor(context, graph, { direction, bilateral }) {
        const overrides =  {};
        if (direction === 'horizontal') overrides.DIRECTION_HORIZONTAL = 1;
        if (bilateral) overrides.BILATERAL = 1;
        super(context, overrides);
    }

    run(graph) {
        super.run();

        const { context: gl } = this;

        this.uniforms.set('u_InputSampler', graph.passes[RenderPass.previous].textures.color);

        this.update();

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 3);
    }
}

export default GaussianProgram;