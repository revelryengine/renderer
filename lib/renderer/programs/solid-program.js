import { GLTFProgram } from './gltf-program.js';

import { fragmentShader } from '../shaders/solid.frag.js';

export class SolidProgram extends GLTFProgram { 
    static fragmentShaderSrc = fragmentShader;

    define(defines) {
        return super.define({ ...defines, USE_SHADOWS: null });
    }

    updateFragment({ input }) {
        const { color = [0, 0, 0, 1] } = input;
        this.uniforms.set('u_Color', color);
    }
}

export default SolidProgram;