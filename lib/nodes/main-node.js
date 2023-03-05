import { GeometryNode } from './geometry-node.js';
import { SHADER_STAGE } from '../constants.js';
import SkyShader from '../shaders/sky-shader.js';

/**
 * The Main Node is responsible for rendering the glTF scene. 
 */
export class MainNode extends GeometryNode {
    attachments = {
        colors: [
            { name: 'color'  },
        ],
        depth: { name: 'depth' },
    }

    opaque = true;
    transmissive = true;
    alpha = true;

    renderAlpha(renderPassEncoder, { graph, instances }) {
        this.skyShader?.run(renderPassEncoder);
        super.renderAlpha(renderPassEncoder, { graph, instances });
    }

    #lastSettings;
    reconfigure() {
        const { settings: { debug, tonemap, temporal,
            msaa:         { enabled: msaaEnabled, samples: msaaSamples },
            environment:  { enabled: environmentEnabled                },
            punctual:     { enabled: punctualEnabled                   }, 
            fog:          { enabled: fogEnabled                        }, 
            ssao:         { enabled: ssaoEnabled                       }, 
            shadows:      { enabled: shadowsEnabled                    },
            transmission: { enabled: transmissionEnabled               },
            skybox:       { enabled: skyboxEnabled                     },
            
        } } = this.renderer;
        const currentSettings = JSON.stringify({ ...debug, tonemap, temporal, msaaEnabled, msaaSamples,
            environmentEnabled, punctualEnabled, fogEnabled, ssaoEnabled, shadowsEnabled, transmissionEnabled, skyboxEnabled,
        });

        if(this.#lastSettings !== currentSettings) {
            this.#lastSettings = currentSettings;
            this.clearShaderCache();
            this.destroy(); // need this to make sure that the dynamic motion texture gets created/destroyed

            if(temporal){
                if(this.attachments.colors.length === 1) {
                    this.attachments.colors.push({ name: 'motion', format: 'rg16float' });
                }
            } else {
                this.attachments.colors.length = 1;
            }
        }

        this.sampleCount = msaaEnabled ? msaaSamples : 1;

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

        if(this.getConnectionValue('transmission')) {
            //transmissionSampler
            this.bindGroupLocations.transmissionSampler = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, sampler: { } });
            entries.group.push({ binding, resource: this.gal.device.createSampler({ minFilter: 'linear', magFilter: 'linear', mipmapFilter: 'linear' }) });

            //transmissionTexture
            this.bindGroupLocations.transmissionTexture = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, texture: { } });
            entries.group.push({ binding, resource: this.getConnectionValue('transmission').texture.createView() });
        }

        if(this.getConnectionValue('ssao')) {
            //ssaoSampler
            this.bindGroupLocations.ssaoSampler = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, sampler: { } });
            entries.group.push({ binding, resource: this.gal.device.createSampler({ minFilter: 'nearest', magFilter: 'nearest' }) });

            //ssaoTexture
            this.bindGroupLocations.ssaoTexture = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, texture: { } });
            entries.group.push({ binding, resource: this.getConnectionValue('ssao')?.texture.createView() });
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

        if(environmentEnabled && skyboxEnabled) {
            this.skyShader = new SkyShader(this.gal, { renderNode: this, sampleCount: this.sampleCount });
        } else {
            this.skyShader = null;
        }
    }

    render(renderPassEncoder, { graph, frustum, instances }) {
        renderPassEncoder.setViewport(...frustum.uniformViewport);
        super.render(renderPassEncoder, { graph, frustum, instances });
    }
}

export default MainNode;