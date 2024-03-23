import { SHADER_STAGE } from '../../../constants.js';
import { Graph        } from '../../../graph.js';

import { Shader } from './shader.js';

import generateWGSL from './generators/outline.wgsl.js';
import generateGLSL from './generators/outline.glsl.js';

/**
 * @extends {Shader<{
 *  view: import('../../../revgal.js').REVTextureView,
 * }>}
 */
export class OutlineShader extends Shader {
    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    /**
     * @type {Shader['getRenderPipelineDescriptor']}
     */
    getRenderPipelineDescriptor(stages) {
        const { gal  } = this;
        const { view } = this.input;

        const bindGroupLayout = gal.device.createBindGroupLayout({
            label: `Outline`,
            entries: [
                { binding: 0, visibility: SHADER_STAGE.FRAGMENT | SHADER_STAGE.VERTEX, sampler: { type: 'non-filtering' } },
                { binding: 1, visibility: SHADER_STAGE.FRAGMENT | SHADER_STAGE.VERTEX, texture: { sampleType: 'uint' } },
            ],
        });

        this.bindGroup = gal.device.createBindGroup({
            label: `Outline`,
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: gal.device.createSampler() },
                { binding: 1, resource: view },
            ],
        });

        const blend = /** @type {const} */({
            color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
            },
            alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
            }
        });

        return {
            label: `outline`,
            layout: gal.device.createPipelineLayout({
                bindGroupLayouts: [
                    this.gal.device.createBindGroupLayout(Graph.bindGroupLayout),
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
                targets: [{ format: 'rgba8unorm', blend }],
            },
            depthStencil: {
                format:              'depth24plus',
                depthWriteEnabled:   false,
                depthCompare:        'greater',
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
