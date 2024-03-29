import { GLTFNode   } from '../../common/nodes/gltf-node.js';
import { GLTFShader } from '../../common/shaders/gltf-shader.js';
import { SkyShader  } from '../shaders/sky-shader.js';

class BaseGLTFShader extends GLTFShader {
    getFlags() {
        const { renderNode: { alpha, settings } } = this.input;

        const flags = super.getFlags();
        return {
            ...flags,

            useLinear:       true,
            useTransmission: false,
            useSSAO:         false,

            debug: null,

            colorTargets: {
                color:  flags.colorTargets.color && settings.flags.transmission,
                blend:  flags.colorTargets.blend && settings.flags.transmission,
                point:  settings.flags.ssao,
                id:     settings.flags.passiveInput
            },

            writeMasks: {
                color: flags.useTransmission ? 0 : flags.writeMasks.color,
                blend: flags.writeMasks.blend,
            }
        }
    }
}

/**
 * The Base Node is responsible for capturing the linear output of all opaque objects along with primitive ids and point info (depth and normal).
 *
 * @extends {GLTFNode<{ settings: import('../standard-settings.js').StandardSettings }>}
 */
export class BaseNode extends GLTFNode {
    Shader = BaseGLTFShader;

    opaque       = true;
    transmissive = true;
    alpha        = true;

    size = { width: 1024, height: 1024 }

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
                passiveInput: passiveInputEnabled,
                alphaBlendMode,
                debugPBR,
                tonemap,
            },
        } = this.settings;

        const currentSettings = JSON.stringify({ debugPBR, tonemap, alphaBlendMode,
            environmentEnabled, punctualEnabled, fogEnabled, ssaoEnabled, shadowsEnabled, transmissionEnabled, skyboxEnabled,
        });

        if(this.#lastSettings !== currentSettings) {
            this.#lastSettings = currentSettings;
            this.clearShaderCache();
            this.destroy();

            // Disable alpha rendering if we are using weighted blending and ssao is enabled when the maxColorAttachmentBytesPerSample limit is too low.
            this.alpha = !((alphaBlendMode === 'weighted') && ssaoEnabled && (this.gal.limits.maxColorAttachmentBytesPerSample < 64));

            this.attachments.colors.color.enabled  = !!transmissionEnabled;
            this.attachments.colors.accum.enabled  = !!transmissionEnabled && (alphaBlendMode === 'weighted') && this.alpha;
            this.attachments.colors.reveal.enabled = !!transmissionEnabled && (alphaBlendMode === 'weighted') && this.alpha;

            this.attachments.colors.point.enabled  = !!ssaoEnabled;
            this.attachments.colors.id.enabled     = !!passiveInputEnabled;
            this.attachments.colors.motion.enabled = false;
        }

        super.reconfigure();

        if(environmentEnabled && skyboxEnabled && transmissionEnabled) {
            this.skyShader = new SkyShader(this.gal, { settings: this.renderPath.settings, renderNode: this }).compileAsync();
        } else {
            this.skyShader = null;
        }

        this.mipmapGenerator = this.attachments.colors.color.texture && this.gal.createMipmapGenerator(this.attachments.colors.color.texture);
    }

    /**
     * @type {GLTFNode['renderOpaque']}
     */
    renderOpaque(renderPassEncoder) {
        super.renderOpaque(renderPassEncoder);
        this.skyShader?.run(renderPassEncoder);
    }

    /**
     * @type {GLTFNode['run']}
     */
    run(commandEncoder) {
        super.run(commandEncoder);
        this.mipmapGenerator?.(commandEncoder);
    }
}

