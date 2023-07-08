import { Shader } from './shader.js';

import generateWGSL from './generators/simple.wgsl.js';
import generateGLSL from './generators/simple.glsl.js';

export class SimpleShader extends Shader {

    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    getRenderPipelineDescriptor() {
        const { gal } = this;
        
        return {
            label: 'Simple',
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
                targets: [{ format: 'rgba8unorm' }],
            },
        }
    }

    /**
     * 
     * @param {*} renderPassEncoder 
     */
    run(renderPassEncoder) {
        renderPassEncoder.setPipeline(this.renderPipeline);
        renderPassEncoder.draw(3, 1, 0, 0);
    }
}

export default SimpleShader;