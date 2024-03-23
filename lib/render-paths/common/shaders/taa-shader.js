import { SHADER_STAGE } from '../../../constants.js';
import { Graph        } from '../../../graph.js';
import { Frustum      } from '../../../frustum.js';

import { Shader } from './shader.js';

import generateWGSL from './generators/taa.wgsl.js';
import generateGLSL from './generators/taa.glsl.js';

export class TAAShader extends Shader {
    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    /**
     * @type {Shader['getRenderPipelineDescriptor']}
     */
    getRenderPipelineDescriptor(stages) {
        const { gal } = this;

        const { color, motion, history } = this.input;

        const bindGroupLayout = gal.device.createBindGroupLayout({
            label: 'TAA',
            entries: [
                { binding: 0, visibility: SHADER_STAGE.FRAGMENT, sampler: { } },
                { binding: 1, visibility: SHADER_STAGE.FRAGMENT, texture: { } },
                { binding: 2, visibility: SHADER_STAGE.FRAGMENT, sampler: { } },
                { binding: 3, visibility: SHADER_STAGE.FRAGMENT, texture: { } },
                { binding: 4, visibility: SHADER_STAGE.FRAGMENT, sampler: { } },
                { binding: 5, visibility: SHADER_STAGE.FRAGMENT, texture: { } },
            ],
        });

        this.bindGroup = gal.device.createBindGroup({
            label: 'TAA',
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: gal.device.createSampler()  },
                { binding: 1, resource: color.texture.createView()  },
                { binding: 2, resource: gal.device.createSampler()  },
                { binding: 3, resource: motion.texture.createView() },
                { binding: 4, resource: gal.device.createSampler()  },
                { binding: 5, resource: history.createView()  },
            ],
        });

        return {
            label: 'TAA',
            layout: gal.device.createPipelineLayout({
                bindGroupLayouts: [
                    gal.device.createBindGroupLayout(Graph.bindGroupLayout),
                    gal.device.createBindGroupLayout(Frustum.bindGroupLayout),
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
