import { GLTFProgram } from './gltf-program.js';

import { fragmentShader } from '../../shaders/empty.frag.js';

export class ShadowProgram extends GLTFProgram {
    static fragmentShaderSrc = fragmentShader;

    define(defines) {
        return super.define({ ...defines, USE_PUNCTUAL: null, USE_SHADOWS: null });
    }
}

export default ShadowProgram;