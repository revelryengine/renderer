import { SHADER_STAGE } from '../../../constants.js';

import { Shader } from './shader.js';

import generateWGSL from './generators/resample.wgsl.js';
import generateGLSL from './generators/resample.glsl.js';

/**
 * @extends {Shader<{
 *  label:         string,
 *  view:          import('../../../revgal.js').REVTextureView,
 *  viewDimension?: '2d' | '2d-array' | 'cube',
 *  format:        GPUTextureFormat,
 *  opaque?:       boolean,
 *  multisampled?: boolean,
 *  minFilter?:    GPUFilterMode,
 *  blend?:        GPUBlendState,
 * }>}
 */
export class ResampleShader extends Shader {
    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    getFlags() {
        const { input: { viewDimension, opaque, format, multisampled } } = this;
        return /** @type {const} */({ viewDimension, opaque, depth: format.includes('depth'), multisampled });
    }

    /**
     * @todo get texture properties from view
     * @see https://github.com/gpuweb/gpuweb/issues/1498
     * @see https://github.com/gpuweb/gpuweb/issues/1497
    */

    /**
     * @type {Shader['getRenderPipelineDescriptor']}
     * @this {this & { flags: NonNullable<ResampleShader['flags']> }}
     */
    getRenderPipelineDescriptor(stages) {
        const { gal } = this;

        const { view, format, viewDimension = '2d', multisampled, minFilter, label, blend } = this.input;

        const bindGroupLayout = gal.device.createBindGroupLayout({
            label: `Resample:${label}`,
            entries: [
                { binding: 0, visibility: SHADER_STAGE.FRAGMENT, sampler: { } },
                { binding: 1, visibility: SHADER_STAGE.FRAGMENT, texture: { viewDimension, multisampled, sampleType: this.flags.depth ? 'depth': undefined } },
            ],
        });

        this.bindGroup = gal.device.createBindGroup({
            label: `Resample:${label}`,
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: gal.device.createSampler({ minFilter }) },
                { binding: 1, resource: view },
            ],
        });

        const targets      = this.flags.depth ? [] : [{ format, blend }];
        const depthStencil = this.flags.depth ? /** @type {const} */({ format, blend, depthWriteEnabled: true, depthCompare: 'always' }) : undefined;

        return {
            label: `Resample:${label}`,
            layout: gal.device.createPipelineLayout({
                bindGroupLayouts: [bindGroupLayout],
            }),
            vertex:   {
                module:     stages.vertex,
                entryPoint: 'main',
            },
            fragment: {
                module:     stages.fragment,
                entryPoint: 'main',
                targets,
            },
            depthStencil,
            primitive: {
                topology: 'triangle-list',
            },
        }
    }

    /**
     * @type {Shader['run']}
     */
    run(renderPassEncoder, layer = 0) {
        if(!this.renderPipeline) return;
        renderPassEncoder.setPipeline(this.renderPipeline);
        renderPassEncoder.setBindGroup(0, this.bindGroup);
        renderPassEncoder.draw(3, 1, layer * 3, 0);
    }
}
