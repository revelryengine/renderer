import { DEFAULT_COLOR_PARAMS } from '../../../constants.js';
import { Graph        } from '../../../graph.js';
import { Frustum      } from '../../../frustum.js';

import { Shader } from '../../common/shaders/shader.js';

import generateWGSL from './generators/sky.wgsl.js';
import generateGLSL from './generators/sky.glsl.js';

export class SkyShader extends Shader {

    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    getLocations() {
        return {
            bindGroup: this.input.renderNode.bindGroupLocations,
        };
    }

    async init() {
        const { gal } = this;

        const { renderNode, sampleCount = 1 } = this.input;
        const targets = [];

        for(const [name, { location, format = DEFAULT_COLOR_PARAMS.format, enabled = DEFAULT_COLOR_PARAMS.enabled }] of Object.entries(renderNode.attachments.colors)) {
            if(enabled) targets[location] = { writeMask: name === 'color' ? 0xF : 0, format };
        }

        this.renderPipeline = gal.device.createRenderPipeline({
            label: this.constructor.name,
            layout: gal.device.createPipelineLayout({
                bindGroupLayouts: [
                    gal.device.createBindGroupLayout(Graph.bindGroupLayout),
                    gal.device.createBindGroupLayout(Frustum.bindGroupLayout),
                    this.input.renderNode.bindGroupLayout,
                ],
            }),
            vertex:   {
                module:     this.vertShader,
                entryPoint: 'main',
            },
            fragment: {
                module:     this.fragShader,
                entryPoint: 'main',
                targets,
            },
            depthStencil: {
                format:              'depth24plus', 
                depthWriteEnabled:   false, 
                depthCompare:        'less-equal',
            },
            multisample: {
                count: sampleCount,
            }
        });
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

export default SkyShader;