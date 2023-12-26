import { GLTFNode   } from '../../common/nodes/gltf-node.js';
import { GLTFShader } from '../../common/shaders/gltf-shader.js';
import { SkyShader  } from '../shaders/sky-shader.js';

class BaseGLTFShader extends GLTFShader {
    getFlags(...args) {
        const { settings } = this.input;

        const flags = super.getFlags(...args);
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
 */
export class BaseNode extends GLTFNode {
    Shader = BaseGLTFShader;

    opaque = true;
    transmissive = true;
    alpha = true;

    size = { width: 1024, height: 1024 }

    #lastSettings;
    reconfigure() {
        const settings = /** @type {import('../standard-settings.js').StandardSettings}*/(this.settings);
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
        } = settings;

        const currentSettings = JSON.stringify({ debugPBR, tonemap, alphaBlendMode,
            environmentEnabled, punctualEnabled, fogEnabled, ssaoEnabled, shadowsEnabled, transmissionEnabled, skyboxEnabled,
        });

        if(this.#lastSettings !== currentSettings) {
            this.#lastSettings = currentSettings;
            this.clearShaderCache();
            this.destroy();

            this.attachments.colors.color.enabled  = !!transmissionEnabled;
            this.attachments.colors.accum.enabled  = !!transmissionEnabled && (alphaBlendMode === 'weighted');
            this.attachments.colors.reveal.enabled = !!transmissionEnabled && (alphaBlendMode === 'weighted');

            this.attachments.colors.point.enabled  = !!ssaoEnabled;
            this.attachments.colors.id.enabled     = !!passiveInputEnabled;
            this.attachments.colors.motion.enabled = false;
        }

        super.reconfigure();

        const { entries, bindGroupLocations } = this.getBindGroupEntries();
        this.bindGroupLocations = bindGroupLocations;

        this.bindGroupLayout = this.gal.device.createBindGroupLayout({
            label: this.constructor.name,
            entries: entries.layout,
        });

        this.bindGroup = this.gal.device.createBindGroup({
            label: this.constructor.name,
            layout: this.bindGroupLayout,
            entries: entries.group,
        });

        if(environmentEnabled && skyboxEnabled && transmissionEnabled) {
            this.skyShader = new SkyShader(this.gal, { settings: this.renderPath.settings, renderNode: this }).compile();
        } else {
            this.skyShader = null;
        }

        this.mipmapGenerator = this.attachments.colors.color.texture && this.gal.createMipmapGenerator(this.attachments.colors.color.texture);
    }

    renderOpaque(renderPassEncoder, ...args) {
        super.renderOpaque(renderPassEncoder, ...args);
        this.skyShader?.run(renderPassEncoder);
    }

    run(commandEncoder, ...args) {
        super.run(commandEncoder, ...args);
        this.mipmapGenerator?.(commandEncoder);
    }
}

export default BaseNode;
