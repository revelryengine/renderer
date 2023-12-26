import { Graph   } from '../../../graph.js';
import { Frustum } from '../../../frustum.js';

import { Shader  } from './shader.js';

import generateWGSL from './generators/grid.wgsl.js';
import generateGLSL from './generators/grid.glsl.js';

export class GridShader extends Shader {

    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    getRenderPipelineDescriptor() {
        const { gal } = this;

        return {
            label: 'Grid',
            layout: gal.device.createPipelineLayout({
                bindGroupLayouts: [
                    this.gal.device.createBindGroupLayout(Graph.bindGroupLayout),
                    this.gal.device.createBindGroupLayout(Frustum.bindGroupLayout),
                ],
            }),
            vertex:   {
                module:     this.vertShader,
                entryPoint: 'main',
            },
            fragment: {
                module:     this.fragShader,
                entryPoint: 'main',
                targets: [
                    {
                        format: 'rgba8unorm',
                        blend: {
                            color: {
                                operation: 'add',
                                srcFactor: 'src-alpha',
                                dstFactor: 'one-minus-src-alpha',
                            },
                            alpha: {
                                operation: 'add',
                                srcFactor: 'one',
                                dstFactor: 'one-minus-src-alpha',
                            }
                        }
                    },
                ],
            },
            depthStencil: {
                format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less'
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'none'
            },
        }
    }

    getCacheKey() {
        const { settings } = this.input;

        return `${super.getCacheKey()}:${settings.constructor.name}`;
    }

    /**
     *
     * @param {*} renderPassEncoder
     */
    run(renderPassEncoder) {
        renderPassEncoder.setPipeline(this.renderPipeline);
        renderPassEncoder.draw(6, 1, 0, 0);
    }
}

export default GridShader;
