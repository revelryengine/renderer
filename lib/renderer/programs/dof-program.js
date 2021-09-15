import { Program } from './program.js';

import { vertexShader   } from '../shaders/simple.vert.js';
import { fragmentShader } from '../shaders/dof.frag.js';

export class DOFProgram extends Program {
    static vertexShaderSrc = vertexShader;
    static fragmentShaderSrc = fragmentShader;

    run({ frustum, input }) {
        super.run();

        const { context: gl } = this;

        const { inFocus, outFocus, depth, distance, range } = input;

        this.uniforms.set('u_Distance', distance);
        this.uniforms.set('u_Range',    range);
        this.uniforms.set('u_Frustum',  frustum);

        this.uniforms.set('u_InFocusSampler',  inFocus.glTexture);
        this.uniforms.set('u_OutFocusSampler', outFocus.glTexture);
        this.uniforms.set('u_DepthSampler',    depth.glTexture);

        this.update();

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 3);
    }
}

export default DOFProgram;