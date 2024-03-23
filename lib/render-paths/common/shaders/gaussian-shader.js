import { SHADER_STAGE } from '../../../constants.js';
import { UBO          } from '../../../ubo.js';

import { Shader } from './shader.js';

import generateWGSL from './generators/gaussian.wgsl.js';
import generateGLSL from './generators/gaussian.glsl.js';

export class Gaussian extends UBO.Layout({
    direction: { type: 'vec2<f32>' },
}){}

/**
 * @extends {Shader<{
 *  format:     GPUTextureFormat,
 *  bilateral?: boolean,
 * }>}
 */
export class GaussianShader extends Shader {
    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    static bindGroupLayoutDescriptor = {
        label: 'Gaussian',
        entries: [
            { binding: 0, visibility: SHADER_STAGE.FRAGMENT, sampler: { } },
            { binding: 1, visibility: SHADER_STAGE.FRAGMENT, texture: { } },
            { binding: 2, visibility: SHADER_STAGE.FRAGMENT, buffer:  { } },
        ],
    }

    /**
     * @type {Shader['getRenderPipelineDescriptor']}
     */
    getRenderPipelineDescriptor(stages) {
        const { gal, input } = this;

        const { format } = input;

        return {
            label: 'Gaussian',
            layout: gal.device.createPipelineLayout({
                bindGroupLayouts: [
                    gal.device.createBindGroupLayout(GaussianShader.bindGroupLayoutDescriptor)
                ],
            }),
            vertex:   {
                module:     stages.vertex,
                entryPoint: 'main',
            },
            fragment: {
                module:     stages.fragment,
                entryPoint: 'main',
                targets: [{ format }],
            },
            primitive: {
                topology: 'triangle-list',
            },
        }
    }

    getFlags() {
        const { input: { bilateral, format } } = this;
        return { bilateral, format };
    }

    /**
     * @type {Shader['run']}
     */
    run(renderPassEncoder) {
        if(!this.renderPipeline) return;
        renderPassEncoder.setPipeline(this.renderPipeline);
        renderPassEncoder.draw(3, 1, 0, 0);
    }
}
