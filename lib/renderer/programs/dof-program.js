import { Program } from './program.js';

import { vertexShader   } from '../shaders/simple.vert.js';
import { fragmentShader } from '../shaders/dof.frag.js';

export class DOFProgram extends Program {
    static vertexShaderSrc   = vertexShader;
    static fragmentShaderSrc = fragmentShader;
    static uniformBindings   = { Frustum: 0 };

    run({ frustum, input }) {
        super.run();

        const { context: gl } = this;

        const { inFocus, outFocus, depth, distance, range } = input;

        this.uniforms.set('u_Distance', distance);
        this.uniforms.set('u_Range',    range);

        this.samplers.set('u_InFocusSampler',  inFocus.glTexture);
        this.samplers.set('u_OutFocusSampler', outFocus.glTexture);
        this.samplers.set('u_DepthSampler',    depth.glTexture);

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 3);
    }
}

export default DOFProgram;