import { PBRProgram } from './pbr-program.js';

export class PreProgram extends PBRProgram {
    constructor(context, primitive, node, graph, additionalDefines = {}) {
        super(context, primitive, node, graph, { ...additionalDefines, PRE_PASS: 1, LINEAR_OUTPUT: 1 });
    }
}