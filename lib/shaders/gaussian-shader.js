import { Shader       } from './shader.js';
import { Graph        } from '../graph.js';
import { Frustum      } from '../frustum.js';
import { SHADER_STAGE } from '../constants.js';

import generateWGSL from './generators/gaussian.wgsl.js';
import generateGLSL from './generators/gaussian.glsl.js';

export class GaussianShader extends Shader {

    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    async init() {
        const { gal  } = this;
        const { color } = this.input;

        const bindGroupLayout = gal.device.createBindGroupLayout({
            label: 'Gaussian',
            entries: [
                { binding: 0, visibility: SHADER_STAGE.FRAGMENT, sampler: { } },
                { binding: 1, visibility: SHADER_STAGE.FRAGMENT, texture: { } },
            ],
        });

        this.bindGroup = gal.device.createBindGroup({
            label: 'Gaussian',
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: gal.device.createSampler({ minFilter: 'linear', magFilter: 'linear' }) },
                { binding: 1, resource: color.texture.createView() },
            ],
        });
        
        this.renderPipeline = gal.device.createRenderPipeline({
            label: 'Gaussian',
            layout: gal.device.createPipelineLayout({
                bindGroupLayouts: [
                    this.gal.device.createBindGroupLayout(Graph.bindGroupLayout),
                    this.gal.device.createBindGroupLayout(Frustum.bindGroupLayout),
                    bindGroupLayout
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
            primitive: {
                topology: 'triangle-list',
            },
        });
    }

    getFlags() {
        const { input: { horizontal, bilateral } } = this;
        return { horizontal, bilateral };
    }

    /**
     * 
     * @param {*} renderPassEncoder 
     */
    run(renderPassEncoder) {
        renderPassEncoder.setPipeline(this.renderPipeline);
        renderPassEncoder.setBindGroup(2, this.bindGroup);
        renderPassEncoder.draw(3, 1, 0, 0);
    }
}

export default GaussianShader;