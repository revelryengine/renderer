import { GLTFShader } from '../../common/shaders/gltf-shader.js';

export class GLTFQueryShader extends GLTFShader {
    getFlags(...args) {
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
                id: true,
                point: true,
            },
        }
    }
}

export class GLTFQueryShaderNoDepthTest extends GLTFQueryShader {
    getFlags(...args) {

        const flags = super.getFlags(...args);
        return {
            ...flags,
            depthWriteEnabled: false
        }
    }
}