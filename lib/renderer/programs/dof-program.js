import { Program } from './program.js';

import { vertexShader   } from '../shaders/simple.vert.js';
import { fragmentShader } from '../shaders/dof.frag.js';

export class DOFProgram extends Program {
    static vertexShaderSrc = vertexShader;
    static fragmentShaderSrc = fragmentShader;

    constructor(context) {
        super(context, {});
    }

    run(graph, input, /* output */) {
        super.run();

        const { context: gl } = this;

        const { inFocus, outFocus, depth, distance, range } = input;
        const { projectionMatrix } = graph.viewInfo;

        const near = projectionMatrix[14] / (projectionMatrix[10] - 1.0);
        const far  = projectionMatrix[14] / (projectionMatrix[10] + 1.0);

        this.uniforms.set('u_Distance', distance);
        this.uniforms.set('u_Range',    range);
        this.uniforms.set('u_Near',  near);
        this.uniforms.set('u_Far',   far);

        this.uniforms.set('u_InFocusSampler',  inFocus.glTexture);
        this.uniforms.set('u_OutFocusSampler', outFocus.glTexture);
        this.uniforms.set('u_DepthSampler',    depth.glTexture);

        this.update();

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 3);
    }
}

export default DOFProgram;