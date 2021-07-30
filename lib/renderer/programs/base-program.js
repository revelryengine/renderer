import { GLTFProgram } from './gltf-program.js';

export class BaseProgram extends GLTFProgram {
    constructor(context, primitive, node, graph, additionalDefines = {}) {
        const overrides = { PRE_PASS: 1, LINEAR_OUTPUT: 1, USE_SSAO: null, DEBUG: 'DEBUG_NONE' };
        super(context, primitive, node, graph, { ...additionalDefines, ...overrides });
    }
}