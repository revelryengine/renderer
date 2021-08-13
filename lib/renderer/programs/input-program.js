import { GLTFProgram } from './gltf-program.js';

import { fragmentShader } from '../shaders/input.frag.js';

export class InputProgram extends GLTFProgram {
    static fragmentShaderSrc = fragmentShader;

    constructor(context, primitive, node, graph, additionalDefines = {}) {
        const overrides = { USE_IBL: null };
        super(context, primitive, node, graph, { ...additionalDefines, ...overrides });
    }
    run(primitive, node, graph, input) {
        if(!this.compiled) this.compile({ sync: true });
        this.use();

        const id = graph.getPrimitiveId(primitive);
        //new Uint8Array([id >> 24, id >> 16, id >> 8, id])
        this.uniforms.set('u_Id', id);
        super.run(primitive, node, graph, input);
    }
}

export default InputProgram;