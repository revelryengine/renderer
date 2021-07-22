import { PBRProgram } from './pbr-program.js';

export class BaseProgram extends PBRProgram {
    constructor(context, primitive, node, graph, additionalDefines = {}) {
        const overrides = { PRE_PASS: 1, LINEAR_OUTPUT: 1, USE_SSAO: null, DEBUG: 'DEBUG_NONE' };
        super(context, primitive, node, graph, { ...additionalDefines, ...overrides });
    }
}