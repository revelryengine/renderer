import { GeometryNode } from './geometry-node.js';
import { GLTFShader   } from '../shaders/gltf-shader.js';
import { SHADER_STAGE } from '../constants.js';

/**
 * The Base Node is responsible for capturing the linear output of all opaque objects along with primitive ids and point info (depth and normal). 
 */
export class BaseNode extends GeometryNode {
    attachments = {
        colors: [
            { name: 'color', mipLevelCount: 11 },
            { name: 'point', format: 'rgba32float' },
        ],
        depth: { name: 'depth' },
    }

    size = { width: 1024, height: 1024 }

    render(renderPassEncoder, { graph, frustum, instances }) {
        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        renderPassEncoder.setBindGroup(1, frustum.bindGroup);
        renderPassEncoder.setBindGroup(2, this.bindGroup);

        const { blocks, buffer } = instances;

        for(const { primitive, mesh, skin, offset, count } of this.iterateBlocks(blocks, { opaque: true })) {
            const material = graph.getActiveMaterial(primitive);
            const shader   = this.getShader({ primitive, mesh, material, skin });
            shader.run(renderPassEncoder, { buffer, offset, count });
        }
    }

    run(commandEncoder, ...args) {
        super.run(commandEncoder, ...args);
        this.mipmapGenerator(commandEncoder);
        // this.gal.generateMipmap(commandEncoder, this.output.color.texture, { format: 'rgba8unorm', mipLevelCount: 11, size: this.size, viewDimension: '2d' });
    }

    #shaders = new WeakMap();
    getShader({ primitive, mesh, material }) {
        const key = GLTFShader.getShaderKey(primitive, material);
        return this.#shaders.get(key) || this.#shaders.set(key, new GLTFShader(this.gal, { 
            primitive, mesh, material, settings: this.renderPath.settings,
            nodeLayout: this.bindGroupLayout, basePass: true,
        })).get(key);
    }

    #lastSettings = {};
    reconfigure() {
        super.reconfigure();

        const { settings: { debug, environment, punctual, tonemap, fog: { enabled: fogEnabled }, ssao: { enabled: ssaoEnabled } } } = this.renderPath;
        const currentSettings = JSON.stringify({ ...debug, environment, punctual, tonemap, fogEnabled, ssaoEnabled });

        if(this.#lastSettings !== currentSettings){
            this.clearShaderCache();
        }

        this.#lastSettings = currentSettings;

        this.bindGroupLayout = this.gal.device.createBindGroupLayout({
            entries: [
                //envSampler
                { binding: 0, visibility: SHADER_STAGE.FRAGMENT, sampler: { } },
                //envLUT
                { binding: 1, visibility: SHADER_STAGE.FRAGMENT, texture: { viewDimension: '2d' } },
                //envGGX
                { binding: 2, visibility: SHADER_STAGE.FRAGMENT, texture: { viewDimension: 'cube' } },
                //envCharlie
                { binding: 3, visibility: SHADER_STAGE.FRAGMENT, texture: { viewDimension: 'cube' } },
                //environment
                { binding: 4, visibility: SHADER_STAGE.FRAGMENT, buffer:  {} },
                //lighting
                { binding: 5, visibility: SHADER_STAGE.FRAGMENT, buffer:  {} },
            ],
        });

        this.bindGroup = this.gal.device.createBindGroup({
            label: 'BaseNode BindGroup',
            layout: this.bindGroupLayout,
            entries: [
                //envSampler
                { binding: 0, resource: this.getConnectionValue('envSampler') },
                //envLUT
                { binding: 1, resource: this.getConnectionValue('envLUT').texture.createView({ dimension: '2d' }) },
                //envGGX
                { binding: 2, resource: this.getConnectionValue('envGGX').texture.createView({ dimension: 'cube' }) },
                //envCharlie
                { binding: 3, resource: this.getConnectionValue('envCharlie').texture.createView({ dimension: 'cube' }) },
                //environment
                { binding: 4, resource: { buffer: this.getConnectionValue('environment').buffer } },
                //lighting
                { binding: 5, resource: { buffer: this.getConnectionValue('lighting').buffer } },
            ]
        });

        this.mipmapGenerator = this.gal.createMipmapGenerator(this.output.color.texture, { format: 'rgba8unorm', mipLevelCount: 11, size: this.size, viewDimension: '2d' });
    }

    clearShaderCache() {
        this.#shaders = new WeakMap();
    }
}

export default BaseNode;