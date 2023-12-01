import { SHADER_STAGE } from '../../../constants.js';
import { Graph        } from '../../../graph.js';
import { Frustum      } from '../../../frustum.js';
import { UBO          } from '../../../ubo.js';

import { Shader } from './shader.js';

import generateWGSL from './generators/poisson.wgsl.js';
import generateGLSL from './generators/poisson.glsl.js';

class PoissonSettings extends UBO.Layout({
    radius: { type: 'f32' },
}){}

export class PoissonShader extends Shader {

    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    getUniforms() {
        const { input: { radius = 20 } } = this;
        return {
            settings: new PoissonSettings(this.gal, { radius }),
        };
    }

    getRenderPipelineDescriptor() {
        const { gal } = this;
        const { color } = this.input;

        const bindGroupLayout = gal.device.createBindGroupLayout({
            label: 'Poisson',
            entries: [
                { binding: 0, visibility: SHADER_STAGE.FRAGMENT, sampler: { } },
                { binding: 1, visibility: SHADER_STAGE.FRAGMENT, texture: { } },
                { binding: 2, visibility: SHADER_STAGE.FRAGMENT, buffer: { } },
            ],
        });

        this.bindGroup = gal.device.createBindGroup({
            label: 'Poisson',
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: gal.device.createSampler({ minFilter: 'linear', magFilter: 'linear' }) },
                { binding: 1, resource: color.texture.createView() },
                { binding: 2, resource: this.uniforms.settings },
            ],
        });

        return {
            label: 'Poisson',
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
        }
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

export default PoissonShader;
