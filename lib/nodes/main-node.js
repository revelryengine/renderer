import { GeometryNode } from './geometry-node.js';
import { SHADER_STAGE } from '../constants.js';

/**
 * The Main Node is responsible for rendering the glTF scene. 
 */
export class MainNode extends GeometryNode {
    attachments = {
        colors: [
            { name: 'color'  },
            // { name: 'motion' },
        ],
        depth: { name: 'depth' },
    }

    sampleCount = 4;

    #lastSettings = {};
    reconfigure() {
        super.reconfigure();

        this.transmission = this.getConnectionValue('transmission')?.texture;

        const { settings: { debug, environment, punctual, tonemap, 
            fog: { enabled: fogEnabled }, 
            ssao: { enabled: ssaoEnabled }, 
            shadows: { enabled: shadowsEnabled },
            transmission: { enabled: transmissionEnabled },
        } } = this.renderPath;
        const currentSettings = JSON.stringify({ ...debug, environment, punctual, tonemap, fogEnabled, ssaoEnabled, shadowsEnabled, transmissionEnabled });

        if(this.#lastSettings !== currentSettings){
            this.clearShaderCache();
        }

        this.#lastSettings = currentSettings;

        let binding = -1;

        this.bindGroupLocations = {};      
        
        const entries = { layout: [], group: [] };
        if(this.getConnectionValue('environment')) {
            //envSampler
            this.bindGroupLocations.envSampler = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, sampler: { } });
            entries.group.push({ binding, resource: this.getConnectionValue('envSampler') });

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
            //transmission
            this.bindGroupLocations.transmission = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, texture: { } });
            entries.group.push({ binding, resource: this.getConnectionValue('transmission').texture.createView() });
        }

        if(this.getConnectionValue('ssao')) {
            //ssaoSampler
            this.bindGroupLocations.ssaoSampler = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, sampler: { } });
            entries.group.push({ binding, resource: this.gal.device.createSampler({ minFilter: 'linear', magFilter: 'linear' }) });

            //ssaoTexture
            this.bindGroupLocations.ssaoTexture = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, texture: { } });
            entries.group.push({ binding, resource: this.getConnectionValue('ssao')?.texture.createView() });
        }

        this.bindGroupLayout = this.gal.device.createBindGroupLayout({
            label: 'MainNode BindGroupLayout',
            entries: entries.layout,
        });

        this.bindGroup = this.gal.device.createBindGroup({
            label: 'MainNode BindGroup',
            layout: this.bindGroupLayout,
            entries: entries.group,
        });
    }

    render(renderPassEncoder, { graph, frustum, instances }) {
        renderPassEncoder.setViewport(...frustum.viewport);
        super.render(renderPassEncoder, { graph, frustum, instances })
    }
}

export default MainNode;