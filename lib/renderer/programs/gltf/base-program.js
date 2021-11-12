import { MaterialProgram } from './material-program.js';

export class BaseProgram extends MaterialProgram {            
    define(defines) {
        return super.define({ ...defines, BASE_PASS: 1, LINEAR_OUTPUT: 1, USE_SSAO: null, USE_BLOOM: null, DEBUG: 'DEBUG_NONE' });
    }
}