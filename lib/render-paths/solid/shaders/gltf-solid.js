import { GLTFShader } from '../../common/shaders/gltf-shader.js';
export class GLTFSolidShader extends GLTFShader {
    getFlags(...args) {
        const { settings } = this.input;

        const flags = super.getFlags(...args);

        flags.hasAttr.TANGENT = false;
        flags.hasAttr.NORMAL  = false;
        flags.hasTexture.normalTexture = false;

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

            lighting: 'solid',
        }
    }
}