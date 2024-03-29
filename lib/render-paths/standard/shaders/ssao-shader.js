
import { SHADER_STAGE, TEXTURE_USAGE } from '../../../constants.js';
import { UBO          } from '../../../ubo.js';
import { Graph        } from '../../../graph.js';
import { Frustum      } from '../../../frustum.js';
import { NonNull, PRNG         } from '../../../../deps/utils.js';

import { Shader } from '../../common/shaders/shader.js';

import generateWGSL from './generators/ssao.wgsl.js';
import generateGLSL from './generators/ssao.glsl.js';

import { vec3 } from '../../../../deps/gl-matrix.js';
import { ColorAttachment } from '../../render-node.js';


const KERNEL_SIZE = 32;
const NOISE_SIZE  = 4;

class SSAOUniform extends UBO.Layout({
    kernel: { type: 'vec3<f32>', count: KERNEL_SIZE },
}){}

const pnrg = new PRNG(28173);

/**
 * @extends {Shader<{
*  settings:   import('../standard-settings.js').StandardSettings,
*  point:      ColorAttachment<'rgba32float'>
*  size:       { width: number, height: number },
*  buffer:     SSAOUniform,
*  noise:      import('../../../revgal.js').REVTexture,
* }>}
*/
export class SSAOShader extends Shader {
    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    /**
     * @param {import('../../../revgal.js').RevGAL} gal
     * @param {{
     *  settings:   import('../standard-settings.js').StandardSettings,
     *  point:      ColorAttachment<'rgba32float'>
     *  size:       { width: number, height: number },
     * }} input
     */
    constructor(gal, input) {
        super(gal, {
            ...input,
            size: { width: input.size.width / NOISE_SIZE, height: input.size.height / NOISE_SIZE  },
            buffer: SSAOShader.createBuffer(gal),
            noise:  SSAOShader.createNoiseTexture(gal),
        });
    }

    getFlags() {
        return { size: this.input.size };
    }

    /**
     * @type {Shader['getRenderPipelineDescriptor']}
     */
    getRenderPipelineDescriptor(stages) {
        const { gal } = this;

        const { point, noise, buffer } = this.input;

        const bindGroupLayout = gal.device.createBindGroupLayout({
            label: 'SSAO',
            entries: [
                { binding: 0, visibility: SHADER_STAGE.FRAGMENT, sampler: { type: 'non-filtering' } },
                { binding: 1, visibility: SHADER_STAGE.FRAGMENT, texture: { sampleType: 'unfilterable-float' } }, // point
                { binding: 2, visibility: SHADER_STAGE.FRAGMENT, sampler: { type: 'non-filtering' } },
                { binding: 3, visibility: SHADER_STAGE.FRAGMENT, texture: { sampleType: 'unfilterable-float' } }, // noise
                { binding: 4, visibility: SHADER_STAGE.FRAGMENT, buffer:  { } },
            ],
        });

        this.bindGroup = gal.device.createBindGroup({
            label: 'SSAO',
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: gal.device.createSampler() },
                { binding: 1, resource: NonNull(point.texture).createView() },
                { binding: 2, resource: gal.device.createSampler({ addressModeU: 'repeat', addressModeV: 'repeat' }) },
                { binding: 3, resource: noise.createView() },
                { binding: 4, resource: buffer },
            ],
        });

        return {
            label: 'SSAO',
            layout: gal.device.createPipelineLayout({
                bindGroupLayouts: [
                    this.gal.device.createBindGroupLayout(Graph.bindGroupLayout),
                    this.gal.device.createBindGroupLayout(Frustum.bindGroupLayout),
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
                targets: [{ format: 'r8unorm' }],
            },
        }
    }

    /**
     * @param {import('../../../revgal.js').RevGAL} gal
     */
    static createBuffer(gal) {
        const kernel = [...Array(KERNEL_SIZE)].map((_, i) => {
            const scale = i / KERNEL_SIZE;
            const sample = vec3.fromValues((pnrg.nextFloat() * 2) - 1, (pnrg.nextFloat() * 2) - 1, pnrg.nextFloat());
            vec3.normalize(sample, sample);
            vec3.scale(sample, sample, SSAOShader.lerp(0.1, 1, scale * scale));
            return [sample[0], sample[1], sample[2]];
        });
        const buffer = new SSAOUniform(gal, { kernel });
        buffer.upload();
        return buffer;
    }

    /**
     * @param {import('../../../revgal.js').RevGAL} gal
     */
    static createNoiseTexture(gal) {
        const format = 'rgba32float';
        const usage  = TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_DST;
        const size   = { width: NOISE_SIZE, height: NOISE_SIZE };
        const data   = new Float32Array([...Array(NOISE_SIZE * NOISE_SIZE)].map(() => {
            return /** @type {number[]} */(vec3.normalize([0, 0, 0, 0], [(pnrg.nextFloat() * 2) - 1, (pnrg.nextFloat() * 2) - 1, 0]));
        }).flat());

        return gal.createTextureWithData({ label: `SSAONoiseTexture`, format, usage, size, data });
    }

    /**
     * @param {number} a
     * @param {number} b
     * @param {number} t
     */
    static lerp (a, b, t) {
        t = t < 0 ? 0 : t;
        t = t > 1 ? 1 : t;
        return a + (b - a) * t;
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
