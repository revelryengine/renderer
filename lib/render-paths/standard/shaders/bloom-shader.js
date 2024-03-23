import { SHADER_STAGE } from '../../../constants.js';
import { Graph        } from '../../../graph.js';
import { Frustum      } from '../../../frustum.js';

import { Shader } from '../../common/shaders/shader.js';

import generateWGSL from './generators/bloom.wgsl.js';
import generateGLSL from './generators/bloom.glsl.js';

import { NonNull } from '../../../../deps/utils.js';

/**
 * @extends {Shader<{
 *  settings: import('../standard-settings.js').StandardSettings,
 *  color:    import('../../render-node.js').ColorAttachment<'rgba8unorm'>,
 *  bloom?:   import('../../render-node.js').ColorAttachment<'rgba8unorm'>,
 *  mode?:    'extract' | 'mix',
 * }>}
 */
export class BloomShader extends Shader {
    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    /**
     * @type {Shader['getRenderPipelineDescriptor']}
     */
    getRenderPipelineDescriptor(stages) {
        const { gal } = this;

        const { color, bloom, mode = 'extract' } = this.input;

        const bindGroupLayout = gal.device.createBindGroupLayout({
            label: 'Bloom',
            entries: [
                { binding: 0, visibility: SHADER_STAGE.FRAGMENT, sampler: { } },
                { binding: 1, visibility: SHADER_STAGE.FRAGMENT, texture: { } },
                mode === 'mix' ? { binding: 2, visibility: SHADER_STAGE.FRAGMENT, texture: { } } : null,
            ].filter(n => n != null),
        });

        this.bindGroup = gal.device.createBindGroup({
            label: 'Bloom',
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: gal.device.createSampler({ minFilter: 'linear', magFilter: 'linear' }) },
                { binding: 1, resource: NonNull(color.texture).createView({ dimension: '2d' }) },
                mode === 'mix' ? { binding: 2, resource: NonNull(bloom?.texture).createView({ dimension: '2d' }) } : null,
            ].filter(n => n != null),
        });

        return {
            label: 'Bloom',
            layout: gal.device.createPipelineLayout({
                bindGroupLayouts: [
                    this.gal.device.createBindGroupLayout(Graph.bindGroupLayout),
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
                targets: [{ format: 'rgba8unorm' }],
            },
        }
    }

    getCacheKey() {
        return `${this.constructor.name}:${this.input.mode}`;
    }

    /**
     * @type {Shader['run']}
     */
    run(renderPassEncoder) {
        if(!this.renderPipeline) return;
        renderPassEncoder.setPipeline(this.renderPipeline);
        renderPassEncoder.setBindGroup(2, this.bindGroup);
        renderPassEncoder.draw(3, 1, 0, 0);
    }
}
