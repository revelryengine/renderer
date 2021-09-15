import { GLTFProgram } from './gltf-program.js';

export class BaseProgram extends GLTFProgram {            
    define(defines) {
        return super.define({ ...defines, BASE_PASS: 1, LINEAR_OUTPUT: 1, USE_SSAO: null, DEBUG: 'DEBUG_NONE' });
    }
}