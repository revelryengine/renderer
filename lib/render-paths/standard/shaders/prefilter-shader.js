import { SHADER_STAGE } from '../../../constants.js';
import { UBO          } from '../../../ubo.js';

import { Shader } from '../../common/shaders/shader.js';

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

const _samplerCache = new WeakMap();

export class PrefilterShader extends Shader {
    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    async init() {
        const { view, format } = this.input;
        const { gal } = this;
        const bindGroupLayout = gal.device.createBindGroupLayout({
            entries: [
                // { binding: 0, visibility: SHADER_STAGE.FRAGMENT, buffer: {} },
                { binding: 0, visibility: SHADER_STAGE.FRAGMENT, sampler: {} },
                { binding: 1, visibility: SHADER_STAGE.FRAGMENT, texture: { viewDimension: 'cube' } }, 
            ],
        });

        this.bindGroup = gal.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                // { binding: 0, resource: { buffer: prefilter.buffer } },
                { binding: 0, resource: this.getSamplerFromCache() },
                { binding: 1, resource: view },
                
            ],
        });

        this.renderPipeline = await gal.createPipelineFromCacheAsync(this.cacheKey, {
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
    getSamplerFromCache() {
        return _samplerCache.get(this.gal) ?? _samplerCache.set(this.gal, this.gal.device.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear' })).get(this.gal);
    }

    getCacheKey() {
        return `${this.constructor.name}:${JSON.stringify(this.input)}`
    }

    run(renderPassEncoder, face) {
        if(!this.ready) return;
        renderPassEncoder.setPipeline(this.renderPipeline);
        renderPassEncoder.setBindGroup(0, this.bindGroup);
        renderPassEncoder.draw(3, 1, face * 3, 0);
    }
}

export class LUTShader extends Shader {
    static wgsl = generateLUTWGSL;
    static glsl = generateLUTGLSL;
    
    async init() {
        const { format } = this.input;
        const { gal    } = this;

        const bindGroupLayout = gal.device.createBindGroupLayout({
            entries: [],
        });

        this.bindGroup = gal.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [],
        });
        
        this.renderPipeline = await gal.createPipelineFromCacheAsync(this.cacheKey, {
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

    getCacheKey() {
        return `${this.constructor.name}:${JSON.stringify(this.input)}`
    }

    run(renderPassEncoder) {
        if(!this.ready) return;
        renderPassEncoder.setPipeline(this.renderPipeline);
        renderPassEncoder.setBindGroup(0, this.bindGroup);
        renderPassEncoder.draw(3, 1, 0, 0);
    }
}

export default PrefilterShader;