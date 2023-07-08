import { SHADER_STAGE } from '../../../constants.js';

import { Shader } from './shader.js';

import generateWGSL from './generators/gaussian.wgsl.js';
import generateGLSL from './generators/gaussian.glsl.js';

export class GaussianShader extends Shader {

    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    getRenderPipelineDescriptor() {
        const { gal   } = this;
        const { color } = this.input;

        const bindGroupLayout = gal.device.createBindGroupLayout({
            label: 'Gaussian',
            entries: [
                { binding: 0, visibility: SHADER_STAGE.FRAGMENT, sampler: { } },
                { binding: 1, visibility: SHADER_STAGE.FRAGMENT, texture: { } },
            ],
        });

        this.bindGroup = gal.device.createBindGroup({
            label: 'Gaussian',
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: gal.device.createSampler({ minFilter: 'linear', magFilter: 'linear' }) },
                { binding: 1, resource: color.texture.createView() },
            ],
        });
        
        return {
            label: 'Gaussian',
            layout: gal.device.createPipelineLayout({
                bindGroupLayouts: [
                    bindGroupLayout
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
            primitive: {
                topology: 'triangle-list',
            },
        }
    }

    getFlags() {
        const { input: { horizontal, bilateral } } = this;
        return { horizontal, bilateral };
    }

    /**
     * 
     * @param {*} renderPassEncoder 
     */
    run(renderPassEncoder) {
        renderPassEncoder.setPipeline(this.renderPipeline);
        renderPassEncoder.setBindGroup(0, this.bindGroup);
        renderPassEncoder.draw(3, 1, 0, 0);
    }
}

export default GaussianShader;