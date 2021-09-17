import { GLTFProgram } from './gltf-program.js';

import { fragmentShader } from '../shaders/pbr.frag.js';

export class MaterialProgram extends GLTFProgram { 
    static fragmentShaderSrc = fragmentShader;
}

export default MaterialProgram;