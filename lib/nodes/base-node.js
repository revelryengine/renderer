import { GeometryNode   } from './geometry-node.js';
import { SHADER_STAGE   } from '../constants.js';
import { GLTFBaseShader } from '../shaders/gltf-shader.js';

/**
 * The Base Node is responsible for capturing the linear output of all opaque objects along with primitive ids and point info (depth and normal). 
 */
export class BaseNode extends GeometryNode {
    Shader = GLTFBaseShader;

    attachments = {
        colors: [
            { name: 'color', mipLevelCount: 11 },
            { name: 'point', format: 'rgba32float' },
        ],
        depth: { name: 'depth' },
    }

    size = { width: 1024, height: 1024 }

    run(commandEncoder, ...args) {
        super.run(commandEncoder, ...args);
        this.mipmapGenerator(commandEncoder);
    }

    * iterateBlocks(blocks) {
        yield * blocks.opaque;
    }

    #lastSettings = {};
    reconfigure() {
        super.reconfigure();

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
            //shadowTexture
            this.bindGroupLocations.shadowsTexture = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, texture: { viewDimension: '2d-array', sampleType: 'depth' } });
            entries.group.push({ binding, resource: this.getConnectionValue('shadows').texture.createView({ dimension: '2d-array', arrayLayerCount: 6 }) });

            //shadowSampler
            this.bindGroupLocations.shadowsSampler = ++binding;
            entries.layout.push({ binding, visibility: SHADER_STAGE.FRAGMENT, sampler: { type: 'comparison'} });
            entries.group.push({ binding, resource: this.getConnectionValue('shadowsSampler') });
        }

        this.bindGroupLayout = this.gal.device.createBindGroupLayout({
            label: 'BaseNode BindGroupLayout',
            entries: entries.layout,
        });

        this.bindGroup = this.gal.device.createBindGroup({
            label: 'BaseNode BindGroup',
            layout: this.bindGroupLayout,
            entries: entries.group,
        });

        this.mipmapGenerator = this.gal.createMipmapGenerator(this.output.color.texture, { format: 'rgba8unorm', mipLevelCount: 11, size: this.size, viewDimension: '2d' });
    }
}

export default BaseNode;