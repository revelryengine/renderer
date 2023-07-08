import { SHADER_STAGE } from '../../../constants.js';
import { Graph        } from '../../../graph.js';
import { Frustum      } from '../../../frustum.js';

import { Shader } from '../../common/shaders/shader.js';

import generateWGSL from './generators/coc.wgsl.js';
import generateGLSL from './generators/coc.glsl.js';

export class CoCShader extends Shader {

    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    getRenderPipelineDescriptor() {
        const { gal } = this;

        const { depth } = this.input;

        const bindGroupLayout = gal.device.createBindGroupLayout({
            label: 'CoC',
            entries: [
                { binding: 0, visibility: SHADER_STAGE.FRAGMENT, sampler: { } },
                { binding: 1, visibility: SHADER_STAGE.FRAGMENT, texture: { sampleType: 'depth' } },
            ],
        });

        this.bindGroup = gal.device.createBindGroup({
            label: 'CoC',
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: gal.device.createSampler() },
                { binding: 1, resource: depth.texture.createView() },
            ],
        });
        
        return {
            label: 'CoC',
            layout: gal.device.createPipelineLayout({
                bindGroupLayouts: [
                    this.gal.device.createBindGroupLayout(Graph.bindGroupLayout),
                    this.gal.device.createBindGroupLayout(Frustum.bindGroupLayout),
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
        };
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

export default CoCShader;