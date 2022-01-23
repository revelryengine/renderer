import { Shader       } from './shader.js';
import { SHADER_STAGE } from '../constants.js';

import { UBO } from '../ubo.js';

import { generate as generateWGSL, generateLUT as generateLUTWGSL } from './generators/prefilter.wgsl.js';
import { generate as generateGLSL, generateLUT as generateLUTGLSL } from './generators/prefilter.glsl.js';

class Prefilter extends UBO {
    static layout = new UBO.Layout([
        { name: 'distribution', type: 'i32' },
        { name: 'roughness',    type: 'f32' },
        { name: 'sampleCount',  type: 'i32' },
        { name: 'lodBias',      type: 'f32' },
    ]);
}

export class PrefilterShader extends Shader {
    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    constructor(gal, { view, format, distribution, roughness, sampleCount }) {
        const prefilter = new Prefilter(gal, { distribution, roughness, sampleCount });
        super(gal, { prefilter });

        const bindGroupLayout = gal.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: SHADER_STAGE.FRAGMENT, buffer: {} },
                { binding: 1, visibility: SHADER_STAGE.FRAGMENT, sampler: {} },
                { binding: 2, visibility: SHADER_STAGE.FRAGMENT, texture: { viewDimension: 'cube' } }, 
            ],
        });

        this.bindGroup = gal.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: prefilter.buffer } },
                { binding: 1, resource: gal.device.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear' }) },
                { binding: 2, resource: view },
                
            ],
        });
        
        this.renderPipeline = gal.device.createRenderPipeline({
            label: 'Prefilter',
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

    run(renderPassEncoder, face) {
        renderPassEncoder.setPipeline(this.renderPipeline);
        renderPassEncoder.setBindGroup(0, this.bindGroup);
        renderPassEncoder.draw(3, 1, face * 3, 0);
    }
}

export class LUTShader extends Shader {
    static wgsl = generateLUTWGSL;
    static glsl = generateLUTGLSL;
    
    constructor(gal, { format, sampleCount }) {
        const prefilter = new Prefilter(gal, { sampleCount });
        super(gal, { prefilter });

        const bindGroupLayout = gal.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: SHADER_STAGE.FRAGMENT, buffer: {} },
            ],
        });

        this.bindGroup = gal.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: prefilter.buffer } },
            ],
        });
        
        this.renderPipeline = gal.device.createRenderPipeline({
            label: 'LUT',
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

    run(renderPassEncoder) {
        renderPassEncoder.setPipeline(this.renderPipeline);
        renderPassEncoder.setBindGroup(0, this.bindGroup);
        renderPassEncoder.draw(3, 1, 0, 0);
    }
}

export default PrefilterShader;