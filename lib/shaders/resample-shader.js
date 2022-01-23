import { Shader } from './shader.js';
import { SHADER_STAGE } from '../constants.js';

import generateWGSL from './generators/resample.wgsl.js';
import generateGLSL from './generators/resample.glsl.js';

export class ResampleShader extends Shader {

    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    /** 
     * @todo: get format and viewDimension from view
     * @see: https://github.com/gpuweb/gpuweb/issues/1498
     * @see: https://github.com/gpuweb/gpuweb/issues/1497
    */
    constructor(gal, { view, format, viewDimension = '2d', minFilter, opaque }) {
        super(gal, { viewDimension, opaque });

        const bindGroupLayout = gal.device.createBindGroupLayout({
            label: 'Resample',
            entries: [
                { binding: 0, visibility: SHADER_STAGE.FRAGMENT, sampler: {} },
                { binding: 1, visibility: SHADER_STAGE.FRAGMENT, texture: { viewDimension } },
            ],
        });

        this.bindGroup = gal.device.createBindGroup({
            label: 'Resample',
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: gal.device.createSampler({ minFilter }) },
                { binding: 1, resource: view },
            ],
        });
        
        this.renderPipeline = gal.device.createRenderPipeline({
            label: 'Resample',
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
                targets: [
                    { format },
                ],
            },
            primitive: {
                topology: 'triangle-list',
            },
        });
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