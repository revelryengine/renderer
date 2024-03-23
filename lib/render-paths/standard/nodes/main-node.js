import { GLTFNode  } from '../../common/nodes/gltf-node.js';
import { SkyShader } from '../shaders/sky-shader.js';

/**
 * The Main Node is responsible for rendering the glTF scene.
 *
 * @extends {GLTFNode<{ settings: import('../standard-settings.js').StandardSettings }>}
 */
export class MainNode extends GLTFNode {
    opaque = true;
    transmissive = true;
    alpha = true;

    #lastSettings = '';
    reconfigure() {
        const {
            flags: {
                environment:  environmentEnabled,
                punctual:     punctualEnabled,
                fog:          fogEnabled,
                ssao:         ssaoEnabled,
                shadows:      shadowsEnabled,
                transmission: transmissionEnabled,
                skybox:       skyboxEnabled,
                alphaBlendMode,
                msaa,
                temporal,
                tonemap,
                debugPBR,
            },
        } = this.settings;

        const currentSettings = JSON.stringify({ debugPBR, tonemap, temporal, alphaBlendMode, msaa,
            environmentEnabled, punctualEnabled, fogEnabled, ssaoEnabled, shadowsEnabled, transmissionEnabled, skyboxEnabled,
        });

        if(this.#lastSettings !== currentSettings) {
            this.#lastSettings = currentSettings;
            this.clearShaderCache();
            this.destroy(); // need this to make sure that the dynamically enabled textures gets created/destroyed

            this.attachments.colors.accum.enabled  = alphaBlendMode === 'weighted';
            this.attachments.colors.reveal.enabled = alphaBlendMode === 'weighted';

            this.attachments.colors.point.enabled  = false;
            this.attachments.colors.id.enabled     = false;
            this.attachments.colors.motion.enabled = temporal;
        }

        this.sampleCount = msaa;

        super.reconfigure();

        if(environmentEnabled && skyboxEnabled) {
            this.skyShader = new SkyShader(this.gal, { settings: this.renderPath.settings, renderNode: this, sampleCount: this.sampleCount }).compileAsync();
        } else {
            this.skyShader = null;
        }
    }

    /**
     * @type {GLTFNode['renderOpaque']}
     */
    renderOpaque(renderPassEncoder) {
        super.renderOpaque(renderPassEncoder);
        this.skyShader?.run(renderPassEncoder);
    }
}
