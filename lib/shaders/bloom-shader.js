import { Shader  } from './shader.js';
import { Graph   } from '../graph.js';
import { Frustum } from '../frustum.js';

import { SHADER_STAGE } from '../constants.js';

import generateWGSL from './generators/bloom.wgsl.js';
import generateGLSL from './generators/bloom.glsl.js';

export class BloomShader extends Shader {

    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    async init() {
        const { gal } = this;

        const { color, bloom, mode = 'extract' } = this.input;

        const bindGroupLayout = gal.device.createBindGroupLayout({
            label: 'Bloom',
            entries: [
                { binding: 0, visibility: SHADER_STAGE.FRAGMENT, sampler: { } },
                { binding: 1, visibility: SHADER_STAGE.FRAGMENT, texture: { } },
                mode === 'mix' ? { binding: 2, visibility: SHADER_STAGE.FRAGMENT, texture: { } } : null,
            ].filter(n => n),
        });

        this.bindGroup = gal.device.createBindGroup({
            label: 'Bloom',
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: gal.device.createSampler() },
                { binding: 1, resource: color.texture.createView() },
                mode === 'mix' ? { binding: 2, resource: bloom.texture.createView() } : null,
            ].filter(n => n),
        });
        
        this.renderPipeline = gal.device.createRenderPipeline({
            label: 'Bloom',
            layout: gal.device.createPipelineLayout({
                bindGroupLayouts: [
                    this.gal.device.createBindGroupLayout(Graph.bindGroupLayout),
                    this.gal.device.createBindGroupLayout(Frustum.bindGroupLayout),
                    bindGroupLayout,
                ],
            }),
            vertex:   {
                module:     this.vertShader,
                entryPoint: 'main',
            },
            fragment: {
                module:     this.fragShader,
                entryPoint: 'main',
                targets: [{ format: 'rgba8unorm' }],
            },
        });
    }

    getCacheKey() {
        return `${this.constructor.name}:${this.input.mode}`;
    }

    /**
     * 
     * @param {*} renderPassEncoder 
     */
    run(renderPassEncoder) {
        renderPassEncoder.setPipeline(this.renderPipeline);
        renderPassEncoder.setBindGroup(2, this.bindGroup);
        renderPassEncoder.draw(3, 1, 0, 0);
    }
}

export default BloomShader;