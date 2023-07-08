import { GLTFShader } from '../../common/shaders/gltf-shader.js';
export class GLTFPreviewShader extends GLTFShader {
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

            lighting: 'preview',
        }
    }
}