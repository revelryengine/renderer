import { Shader  } from './shader.js';

import generateWGSL from './generators/simple.wgsl.js';
import generateGLSL from './generators/simple.glsl.js';
import { Graph   } from '../graph.js';
import { Frustum } from '../frustum.js';

export class SimpleShader extends Shader {

    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    async init() {
        const { gal } = this;

        const bindGroupLayout = gal.device.createBindGroupLayout({
            label: 'Simple',
            entries: [],
        });

        this.bindGroup = gal.device.createBindGroup({
            label: 'Simple',
            layout: bindGroupLayout,
            entries: [],
        });
        
        this.renderPipeline = gal.device.createRenderPipeline({
            label: 'Simple',
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
        });
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

export default SimpleShader;