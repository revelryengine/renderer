import { GLTFNode   } from '../common/nodes/gltf-node.js';
import { GLTFShader } from '../common/shaders/gltf-shader.js';

class GLTFSolidShader extends GLTFShader {
    getFlags() {
        const { renderNode: { settings } } = this.input;

        const flags = super.getFlags();

        flags.hasAttr.TANGENT = false;
        flags.hasAttr.NORMAL  = false;
        flags.hasTexture.normalTexture = false;

        return /** @type {const} */({
            ...flags,

            useShadows:      false,
            usePunctual:     false,
            useEnvironment:  false,
            useTransmission: false,
            useSSAO:         false,
            useFog:          false,

            colorTargets: {
                color:  true,
                motion: settings.flags.temporal,
            },

            lighting: 'solid',
        })
    }
}

/**
 * The Solid Node is responsible for rendering all glTF objects with solid shading.
 *
 * @extends {GLTFNode<{ settings: import('./solid-settings.js').SolidSettings }>}
 */
export class SolidNode extends GLTFNode {
    Shader = GLTFSolidShader;

    opaque       = true;
    transmissive = true;
    alpha        = true;

    #lastSettings = '';
    reconfigure() {
        const {
            flags: {
                msaa,
                temporal,
            }
        } = this.settings;

        const currentSettings = JSON.stringify({ temporal, msaa });

        if(this.#lastSettings !== currentSettings) {
            this.#lastSettings = currentSettings;
            this.clearShaderCache();
            this.destroy(); // need this to make sure that the dynamically enabled textures gets created/destroyed

            this.attachments.colors.accum.enabled  = false;
            this.attachments.colors.reveal.enabled = false;

            this.attachments.colors.point.enabled  = false;
            this.attachments.colors.id.enabled     = false;
            this.attachments.colors.motion.enabled = temporal;
        }

        this.sampleCount = msaa;

        super.reconfigure();
    }

    getBindGroupEntries( ){
        return null;
    }
}

