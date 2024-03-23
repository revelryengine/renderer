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

    getFlags() {
        const { renderNode, sampleCount } = this.input;

        const targets = [];

        let location = 0;
        for(const [name, { format, enabled }] of Object.entries(renderNode.attachments.colors)) {
            if(enabled) targets[location] = { writeMask: name === 'color' ? 0xF : 0, format };
            location++;
        }

        return { targets, sampleCount }
    }

    /**
     * @type {Shader['getRenderPipelineDescriptor']}
     * @this {this & { flags: NonNullable<ReturnType<SkyShader['getFlags']>> }}
     */
    getRenderPipelineDescriptor(stages) {
        const { gal, flags: { targets } } = this;

        const { sampleCount = 1 } = this.input;

        return {
            label: this.constructor.name + `(${targets.length})`,
            layout: gal.device.createPipelineLayout({
                bindGroupLayouts: [
                    gal.device.createBindGroupLayout(Graph.bindGroupLayout),
                    gal.device.createBindGroupLayout(Frustum.bindGroupLayout),
                    this.input.renderNode.bindGroupLayout,
                ],
            }),
            vertex:   {
                module:     stages.vertex,
                entryPoint: 'main',
            },
            fragment: {
                module:     stages.fragment,
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
        }
    }

    /**
     * @type {Shader ['run']}
     */
    run(renderPassEncoder) {
        if(!this.renderPipeline) return;
        renderPassEncoder.setPipeline(this.renderPipeline);
        renderPassEncoder.draw(3, 1, 0, 0);
    }
}
