import { SHADER_STAGE } from '../../../constants.js';
import { UBO          } from '../../../ubo.js';

import { Shader } from '../../common/shaders/shader.js';

import { generate as generateWGSL, generateLUT as generateLUTWGSL } from './generators/prefilter.wgsl.js';
import { generate as generateGLSL, generateLUT as generateLUTGLSL } from './generators/prefilter.glsl.js';

export class Prefilter extends UBO.Layout({
    roughness: { type: 'f32' },
}){}

export class PrefilterShader extends Shader {
    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    getRenderPipelineDescriptor() {
        const { format } = this.input;
        const { gal    } = this;

        const bindGroupLayouts = [
            gal.device.createBindGroupLayout({
                entries: [
                    { binding: 0, visibility: SHADER_STAGE.FRAGMENT, sampler: {} },
                    { binding: 1, visibility: SHADER_STAGE.FRAGMENT, texture: { viewDimension: 'cube' } },
                ],
            }),
            gal.device.createBindGroupLayout({
                entries: [
                    { binding: 0, visibility: SHADER_STAGE.FRAGMENT, buffer: {} },
                ],
            }),
        ];

        return {
            label: 'Prefilter',
            layout: gal.device.createPipelineLayout({
                bindGroupLayouts,
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
        }

    }

    getCacheKey() {
        return `${this.constructor.name}:${JSON.stringify(this.input)}`
    }

    run(renderPassEncoder, face) {
        renderPassEncoder.setPipeline(this.renderPipeline);
        renderPassEncoder.draw(3, 1, face * 3, 0);
    }
}

export class LUTShader extends Shader {
    static wgsl = generateLUTWGSL;
    static glsl = generateLUTGLSL;

    getRenderPipelineDescriptor() {
        const { format } = this.input;
        const { gal    } = this;

        return {
            label: 'LUT',
            layout: gal.device.createPipelineLayout({
                bindGroupLayouts: [],
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
        }
    }

    getCacheKey() {
        return `${this.constructor.name}:${JSON.stringify(this.input)}`
    }

    run(renderPassEncoder) {
        renderPassEncoder.setPipeline(this.renderPipeline);
        renderPassEncoder.draw(3, 1, 0, 0);
    }
}

export default PrefilterShader;
