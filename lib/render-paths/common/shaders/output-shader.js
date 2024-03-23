import { SHADER_STAGE } from '../../../constants.js';
import { Frustum      } from '../../../frustum.js';

import { Shader } from './shader.js';

import generateWGSL from './generators/output.wgsl.js';
import generateGLSL from './generators/output.glsl.js';

/**
 * @extends {Shader<{
 *  view:   import('../../../revgal.js').REVTextureView,
 *  format: GPUTextureFormat,
 * }>}
 */
export class OutputShader extends Shader {
    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    /**
     * @type {Shader['getRenderPipelineDescriptor']}
     */
    getRenderPipelineDescriptor(stages) {
        const { gal } = this;
        const { view, format } = this.input;

        const bindGroupLayout = gal.device.createBindGroupLayout({
            label: `Output`,
            entries: [
                { binding: 0, visibility: SHADER_STAGE.FRAGMENT | SHADER_STAGE.VERTEX, sampler: { } },
                { binding: 1, visibility: SHADER_STAGE.FRAGMENT | SHADER_STAGE.VERTEX, texture: { } },
            ],
        });

        this.bindGroup = gal.device.createBindGroup({
            label: `Output`,
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: gal.device.createSampler() },
                { binding: 1, resource: view },
            ],
        });

        return {
            label: `Output`,
            layout: gal.device.createPipelineLayout({
                bindGroupLayouts: [
                    this.gal.device.createBindGroupLayout(Frustum.bindGroupLayout),
                    bindGroupLayout,
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

    /**
     * @type {Shader['run']}
     */
    run(renderPassEncoder) {
        if(!this.renderPipeline) return;
        renderPassEncoder.setPipeline(this.renderPipeline);
        renderPassEncoder.setBindGroup(1, this.bindGroup);
        renderPassEncoder.draw(3, 1, 0, 0);
    }
}
