import { GLTFNode       } from '../../common/nodes/gltf-node.js';
import { GLTFBaseShader } from '../../common/shaders/gltf-shader.js';
import { SkyShader      } from '../shaders/sky-shader.js';

/**
 * The Base Node is responsible for capturing the linear output of all opaque objects along with primitive ids and point info (depth and normal). 
 */
export class BaseNode extends GLTFNode {
    Shader = GLTFBaseShader;

    opaque = true;
    transmissive = true;
    alpha = true;

    size = { width: 1024, height: 1024 }

    #lastSettings;
    reconfigure() {
        const { 
            debug, tonemap, alphaBlendMode,
            environment:  { enabled: environmentEnabled  },
            punctual:     { enabled: punctualEnabled     }, 
            fog:          { enabled: fogEnabled          }, 
            ssao:         { enabled: ssaoEnabled         }, 
            shadows:      { enabled: shadowsEnabled      },
            transmission: { enabled: transmissionEnabled },
            skybox:       { enabled: skyboxEnabled       },
            passiveInput: { enabled: passiveInputEnabled },
        } = this.settings;

        const currentSettings = JSON.stringify({ ...debug, tonemap, alphaBlendMode,
            environmentEnabled, punctualEnabled, fogEnabled, ssaoEnabled, shadowsEnabled, transmissionEnabled, skyboxEnabled,
        });

        if(this.#lastSettings !== currentSettings) {
            this.#lastSettings = currentSettings;
            this.clearShaderCache();
            this.destroy();

            this.attachments.colors.color.enabled  = transmissionEnabled;
            this.attachments.colors.accum.enabled  = transmissionEnabled && (alphaBlendMode === 'weighted');
            this.attachments.colors.reveal.enabled = transmissionEnabled && (alphaBlendMode === 'weighted');

            this.attachments.colors.point.enabled  = ssaoEnabled;
            this.attachments.colors.id.enabled     = passiveInputEnabled;
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
            this.skyShader = new SkyShader(this.gal, { renderNode: this }).compile();
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