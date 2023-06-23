import { GLTFNode       } from './gltf-node.js';
import { SHADER_STAGE   } from '../constants.js';
import { GLTFBaseShader } from '../shaders/gltf-shader.js';
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
        const { settings: { debug, tonemap, alphaBlendMode,
            environment:  { enabled: environmentEnabled  },
            punctual:     { enabled: punctualEnabled     }, 
            fog:          { enabled: fogEnabled          }, 
            ssao:         { enabled: ssaoEnabled         }, 
            shadows:      { enabled: shadowsEnabled      },
            transmission: { enabled: transmissionEnabled },
            skybox:       { enabled: skyboxEnabled       },
            passiveInput: { enabled: passiveInputEnabled },
        } } = this.renderer;
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

        let binding = -1;

        this.bindGroupLocations = {};      
        
        const entries = { layout: [], group: [] };
        if(this.getConnectionValue('environment')) {
            //envSampler
            this.bindGroupLocations.envSampler = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, sampler: { } });
            entries.group.push({ binding, resource: this.gal.device.createSampler({ minFilter: 'linear', magFilter: 'linear', mipmapFilter: 'linear' }) });

            //envLUT
            this.bindGroupLocations.envLUT = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, texture: { } });
            entries.group.push({ binding, resource: this.getConnectionValue('envLUT').texture.createView() });

            //envGGX
            this.bindGroupLocations.envGGX = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, texture: { viewDimension: 'cube' } });
            entries.group.push({ binding, resource: this.getConnectionValue('envGGX').texture.createView({ dimension: 'cube' }) });

            //envCharlie
            this.bindGroupLocations.envCharlie = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, texture: { viewDimension: 'cube' } });
            entries.group.push({ binding, resource: this.getConnectionValue('envCharlie').texture.createView({ dimension: 'cube' }) });

            //environment
            this.bindGroupLocations.environment = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, buffer:  { } });
            entries.group.push({ binding, resource: { buffer: this.getConnectionValue('environment').buffer } });
        }

        if(this.getConnectionValue('punctual')) {
            //punctual
            this.bindGroupLocations.punctual = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT | SHADER_STAGE.VERTEX, buffer:  { } });
            entries.group.push({ binding, resource: { buffer: this.getConnectionValue('punctual').buffer } });
        }

        if(this.getConnectionValue('shadows')) {
            //shadowSampler
            this.bindGroupLocations.shadowsSampler = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, sampler: { type: 'comparison'} });
            entries.group.push({ binding, resource: this.getConnectionValue('shadowsSampler') });

            //shadowTexture
            this.bindGroupLocations.shadowsTexture = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, texture: { viewDimension: '2d-array', sampleType: 'depth' } });
            entries.group.push({ binding, resource: this.getConnectionValue('shadows').texture.createView({ dimension: '2d-array', arrayLayerCount: 6 }) });
        }

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
            this.skyShader = new SkyShader(this.gal, { renderNode: this });
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