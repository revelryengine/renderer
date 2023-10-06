import { SHADER_STAGE } from '../../../constants.js';

import { Shader } from './shader.js';

import generateWGSL from './generators/resample.wgsl.js';
import generateGLSL from './generators/resample.glsl.js';

export class ResampleShader extends Shader {

    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    /** 
     * @todo: get texture properties from view
     * @see: https://github.com/gpuweb/gpuweb/issues/1498
     * @see: https://github.com/gpuweb/gpuweb/issues/1497
    */

    getRenderPipelineDescriptor() {
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
        const depthStencil = this.flags.depth ? { format, blend, depthWriteEnabled: true, depthCompare: 'always' } : undefined;
        
        return {
            label: `Resample:${label}`,
            layout: gal.device.createPipelineLayout({
                bindGroupLayouts: [bindGroupLayout],
            }),
            vertex:   {
                module:     this.vertShader,
                entryPoint: 'main',
            },
            fragment: {
                module:     this.fragShader,
                entryPoint: 'main',
                targets,
            },
            depthStencil,
            primitive: {
                topology: 'triangle-list',
            },
        }
    }

    getFlags() {
        const { input: { viewDimension, opaque, format, multisampled } } = this;
        return { viewDimension, opaque, depth: format.includes('depth'), multisampled }
    }

    /**
     * 
     * @param {*} renderPassEncoder 
     * @param {*} layer - layer or face to sample from
     */
    run(renderPassEncoder, layer = 0) {
        renderPassEncoder.setPipeline(this.renderPipeline);
        renderPassEncoder.setBindGroup(0, this.bindGroup);
        renderPassEncoder.draw(3, 1, layer * 3, 0);
    }
}

export default ResampleShader;