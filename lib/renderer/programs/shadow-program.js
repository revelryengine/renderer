import { GLTFProgram } from './gltf-program.js';

import { fragmentShader } from '../shaders/empty.frag.js';

export class ShadowProgram extends GLTFProgram {
    static fragmentShaderSrc = fragmentShader;

    constructor(context, primitive, node, graph, additionalDefines = {}) {
        const overrides = { SHADOW_PASS: 1, USE_SHADOWS: null };
        super(context, primitive, node, graph, { ...additionalDefines, ...overrides });
    }
    // run(primitive, node, graph, input) {
    //     super.run(primitive, node, graph, input);
    // }
}

export default ShadowProgram;