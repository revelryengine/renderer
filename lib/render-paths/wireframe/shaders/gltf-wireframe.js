import { GLTFShader } from '../../standard/shaders/gltf-shader.js';

import generateWGSL from './generators/gltf/gltf.wgsl.js';
import generateGLSL from './generators/gltf/gltf.glsl.js';

export class GLTFWireframeShader extends GLTFShader {
    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    getFlags(...args) {
        const { settings } = this.input;

        const flags = super.getFlags(...args);
        return {
            ...flags,
            useShadows      : false,
            usePunctual     : false,
            useEnvironment  : false,
            useTransmission : false,
            useSSAO         : false,
            useFog          : false,

            colorTargets: {
                color:  true,
                motion: settings.temporal,
            },

            doubleSided: true,
            useBarycentric: true,
            deindex: true,
        }
    }
}