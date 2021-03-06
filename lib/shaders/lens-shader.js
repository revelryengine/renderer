import { Shader  } from './shader.js';

import { SHADER_STAGE } from '../constants.js';

import generateWGSL from './generators/lens.wgsl.js';
import generateGLSL from './generators/lens.glsl.js';

export class LensShader extends Shader {

    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    async init() {
        const { gal } = this;

        const { color, coc } = this.input;

        const bindGroupLayout = gal.device.createBindGroupLayout({
            label: 'Lens',
            entries: [
                { binding: 0, visibility: SHADER_STAGE.FRAGMENT, sampler: { } },
                { binding: 1, visibility: SHADER_STAGE.FRAGMENT, texture: { } },
                { binding: 2, visibility: SHADER_STAGE.FRAGMENT, texture: { } },
            ],
        });

        this.bindGroup = gal.device.createBindGroup({
            label: 'Lens',
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: gal.device.createSampler() },
                { binding: 1, resource: color.texture.createView() },
                { binding: 2, resource: coc.texture.createView() },
            ],
        });
        
        this.renderPipeline = gal.device.createRenderPipeline({
            label: 'Lens',
            layout: gal.device.createPipelineLayout({
                bindGroupLayouts: [
                    bindGroupLayout,
                ],
            }),
            vertex:   {
                module:     this.vertShader,
                entryPoint: 'main',
            },
            fragment: {
                module:     this.fragShader,
                entryPoint: 'main',
                targets: [{ format: 'rgba8unorm' }],
            },
        });
    }

    /**
     * 
     * @param {*} renderPassEncoder 
     */
    run(renderPassEncoder) {
        renderPassEncoder.setPipeline(this.renderPipeline);
        renderPassEncoder.setBindGroup(0, this.bindGroup);
        renderPassEncoder.draw(3, 1, 0, 0);
    }
}

export default LensShader;