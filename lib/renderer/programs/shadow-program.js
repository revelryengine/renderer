import { GLTFProgram } from './gltf-program.js';

import { fragmentShader } from '../shaders/empty.frag.js';

export class ShadowProgram extends GLTFProgram {
    static fragmentShaderSrc = fragmentShader;

    // run(primitive, node, graph, input) {
    //     super.run(primitive, node, graph, input);
    // }
}

export default ShadowProgram;