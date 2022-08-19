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

        const { settings: { debug, environment, punctual, tonemap, fog: { enabled: fogEnabled }, ssao: { enabled: ssaoEnabled }, shadows: { enabled: shadowsEnabled } } } = this.renderPath;
        const currentSettings = JSON.stringify({ ...debug, environment, punctual, tonemap, fogEnabled, ssaoEnabled, shadowsEnabled });

        if(this.#lastSettings !== currentSettings){
            this.clearShaderCache();
        }

        this.#lastSettings = currentSettings;

        this.bindGroupLayout = this.gal.device.createBindGroupLayout({
            entries: [
                //envSampler
                { binding: 0, visibility: SHADER_STAGE.FRAGMENT, sampler: { } },
                //envLUT
                { binding: 1, visibility: SHADER_STAGE.FRAGMENT, texture: { } },
                //envGGX
                { binding: 2, visibility: SHADER_STAGE.FRAGMENT, texture: { viewDimension: 'cube' } },
                //envCharlie
                { binding: 3, visibility: SHADER_STAGE.FRAGMENT, texture: { viewDimension: 'cube' } },
                //environment
                { binding: 4, visibility: SHADER_STAGE.FRAGMENT, buffer:  { } },
                //lighting
                { binding: 5, visibility: SHADER_STAGE.FRAGMENT | SHADER_STAGE.VERTEX, buffer:  { } },
                //shadows
                { binding: 6, visibility: SHADER_STAGE.FRAGMENT, texture: { viewDimension: '2d-array', sampleType: 'depth' } },
                { binding: 7, visibility: SHADER_STAGE.FRAGMENT, sampler: { type: 'comparison'} },
            ],
        });

        this.bindGroup = this.gal.device.createBindGroup({
            label: 'BaseNode BindGroup',
            layout: this.bindGroupLayout,
            entries: [
                //envSampler
                { binding: 0, resource: this.getConnectionValue('envSampler') },
                //envLUT
                { binding: 1, resource: this.getConnectionValue('envLUT').texture.createView() },
                //envGGX
                { binding: 2, resource: this.getConnectionValue('envGGX').texture.createView({ dimension: 'cube' }) },
                //envCharlie
                { binding: 3, resource: this.getConnectionValue('envCharlie').texture.createView({ dimension: 'cube' }) },
                //environment
                { binding: 4, resource: { buffer: this.getConnectionValue('environment').buffer } },
                //lighting
                { binding: 5, resource: { buffer: this.getConnectionValue('lighting').buffer } },
                //shadows
                { binding: 6, resource: this.getConnectionValue('shadows').texture.createView({ dimension: '2d-array', arrayLayerCount: 6 }) },
                { binding: 7, resource: this.getConnectionValue('shadowSampler') },
            ]
        });

        this.mipmapGenerator = this.gal.createMipmapGenerator(this.output.color.texture, { format: 'rgba8unorm', mipLevelCount: 11, size: this.size, viewDimension: '2d' });
    }
}

export default BaseNode;