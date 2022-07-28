import { GeometryNode } from './geometry-node.js';
import { GLTFShader   } from '../shaders/gltf-shader.js';
import { SHADER_STAGE } from '../constants.js';

/**
 * The Base Node is responsible for capturing the linear output of all opaque objects along with primitive ids and point info (depth and normal). 
 */
export class MainNode extends GeometryNode {
    attachments = {
        colors: [
            { name: 'color' }
        ],
        depth: { name: 'depth' },
    }

    sampleCount = 4;

    render(renderPassEncoder, { graph, frustum, instances }) {
        renderPassEncoder.setViewport(...frustum.viewport);
        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        renderPassEncoder.setBindGroup(1, frustum.bindGroup);
        renderPassEncoder.setBindGroup(2, this.bindGroup);

        const { blocks, buffer } = instances;

        for(const { primitive, mesh, skin, offset, count } of this.iterateBlocks(blocks, { opaque: true, transmissive: true, alpha: true })) {
            const material = graph.getActiveMaterial(primitive);
            const shader   = this.getShader({ primitive, mesh, material, skin });
            shader.run(renderPassEncoder, { buffer, offset, count });
        }
    }

    #shaders = new WeakMap();
    getShader({ primitive, mesh, material }) {
        const key = GLTFShader.getShaderKey(primitive, material);
        return this.#shaders.get(key) || this.#shaders.set(key, new GLTFShader(this.gal, { 
            primitive, mesh, material, settings: this.renderPath.settings,
            nodeLayout: this.bindGroupLayout, multisample: true, transmission: true
        })).get(key);
    }

    #lastSettings = {};
    reconfigure() {
        super.reconfigure();

        this.transmission = this.getConnectionValue('transmission').texture;

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
                { binding: 1, visibility: SHADER_STAGE.FRAGMENT, texture: { } },
                //envGGX
                { binding: 2, visibility: SHADER_STAGE.FRAGMENT, texture: { viewDimension: 'cube' } },
                //envCharlie
                { binding: 3, visibility: SHADER_STAGE.FRAGMENT, texture: { viewDimension: 'cube' } },
                //environment
                { binding: 4, visibility: SHADER_STAGE.FRAGMENT, buffer:  {} },
                //lighting
                { binding: 5, visibility: SHADER_STAGE.FRAGMENT, buffer:  {} },
                //transmission
                { binding: 6, visibility: SHADER_STAGE.FRAGMENT, texture: { } },
                //ssao
                ssaoEnabled ? { binding: 7, visibility: SHADER_STAGE.FRAGMENT, sampler: { } } : null,
                ssaoEnabled ? { binding: 8, visibility: SHADER_STAGE.FRAGMENT, texture: { } } : null,
            ].filter(n => n),
        });

        this.bindGroup = this.gal.device.createBindGroup({
            label: 'MainNode BindGroup',
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
                //transmission
                { binding: 6, resource: this.getConnectionValue('transmission').texture.createView() },
                //ssao
                ssaoEnabled ? { binding: 7, resource: this.gal.device.createSampler({ minFilter: 'linear', magFilter: 'linear' }) } : null,
                ssaoEnabled ? { binding: 8, resource: this.getConnectionValue('ssao')?.texture.createView() } : null,
            ].filter(n => n)
        });
    }

    clearShaderCache() {
        this.#shaders    = new WeakMap();
    }
}

export default MainNode;