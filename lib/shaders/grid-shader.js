import { Shader       } from './shader.js';
import { SHADER_STAGE } from '../constants.js';
import { UBO          } from '../ubo.js';
import { Frustum      } from '../frustum.js';

import generateWGSL from './generators/grid.wgsl.js';
import generateGLSL from './generators/grid.glsl.js';

class Grid extends UBO {
    static layout = new UBO.Layout([
        { name: 'colorThick', type: 'vec4<f32>' },
        { name: 'colorThin',  type: 'vec4<f32>' },
        { name: 'increment',  type: 'f32' },
    ]);
}

export class GridShader extends Shader {

    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    constructor(gal, input) {
        super(gal, { ...input, grid: new Grid(gal) });
    }
    async init() {
        const { gal  } = this;
        const { grid } = this.input;

        this.bindGroupLayout = gal.device.createBindGroupLayout({
            label: 'Grid',
            entries: [
                { binding: 0, visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT, buffer: {} },
            ],
        });

        this.bindGroup = gal.device.createBindGroup({
            label: 'Grid',
            layout: this.bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: grid.buffer } },
            ],
        });
        
        this.renderPipeline = gal.device.createRenderPipeline({
            label: 'Grid',
            layout: gal.device.createPipelineLayout({
                bindGroupLayouts: [
                    this.gal.device.createBindGroupLayout(Frustum.bindGroupLayout),
                    this.bindGroupLayout,
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
        });
    }

    /**
     * 
     * @param {*} renderPassEncoder 
     * @param {*} settings - grid settings
     */
    run(renderPassEncoder, settings) {
        if(!this.ready) return;
        const { 
            increment = 0.1,
            colors: {
                thick = [1, 1, 1, 0.5], 
                thin  = [0.5, 0.5, 0.5, 0.5], 
            } = {},
        }  = settings;

        this.input.grid.increment  = increment;
        this.input.grid.colorThick = thick;
        this.input.grid.colorThin  = thin;
        this.input.grid.upload();

        renderPassEncoder.setPipeline(this.renderPipeline);
        renderPassEncoder.setBindGroup(1, this.bindGroup);
        renderPassEncoder.draw(6, 1, 0, 0);
    }
}

export default GridShader;