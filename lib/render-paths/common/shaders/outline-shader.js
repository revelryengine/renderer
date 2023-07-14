import { SHADER_STAGE } from '../../../constants.js';
import { Graph        } from '../../../graph.js';

import { Shader } from './shader.js';

import generateWGSL from './generators/outline.wgsl.js';
import generateGLSL from './generators/outline.glsl.js';

export class OutlineShader extends Shader {

    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    getRenderPipelineDescriptor() {
        const { gal } = this;
        const { view, format } = this.input;

        const bindGroupLayout = gal.device.createBindGroupLayout({
            label: `outline`,
            entries: [
                { binding: 0, visibility: SHADER_STAGE.FRAGMENT | SHADER_STAGE.VERTEX, sampler: { type: 'uint' } },
                { binding: 1, visibility: SHADER_STAGE.FRAGMENT | SHADER_STAGE.VERTEX, texture: { } },
            ],
        });

        this.bindGroup = gal.device.createBindGroup({
            label: `outline`,
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: gal.device.createSampler() },
                { binding: 1, resource: view },
            ],
        });
        
        const blend = {
            color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
            },
            alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
            }
        };

        return {
            label: `outline`,
            layout: gal.device.createPipelineLayout({
                bindGroupLayouts: [
                    this.gal.device.createBindGroupLayout(Graph.bindGroupLayout),
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
                targets: [{ format, blend }],
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
        renderPassEncoder.setBindGroup(1, this.bindGroup);
        renderPassEncoder.draw(3, 1, 0, 0);
    }
}

export default OutlineShader;