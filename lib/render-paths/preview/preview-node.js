import { GLTFNode   } from '../common/nodes/gltf-node.js';
import { GLTFShader } from '../common/shaders/gltf-shader.js';

class GLTFPreviewShader extends GLTFShader {
    getFlags() {
        const { renderNode: { settings } } = this.input;

        const flags = super.getFlags();

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

            lighting: 'preview',
        })
    }
}

/**
 * The Preview Node is responsible for rendering all glTF objects with materials but no lighting.
 *
 * @extends {GLTFNode<{ settings: import('./preview-settings.js').PreviewSettings }>}
 */
export class PreviewNode extends GLTFNode {
    Shader = GLTFPreviewShader;

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
