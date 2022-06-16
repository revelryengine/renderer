import { Shader  } from './shader.js';
import { Graph   } from '../graph.js';
import { Frustum } from '../frustum.js';
import { UBO     } from '../ubo.js';
import { vec3    } from '../../deps/gl-matrix.js';

import { SHADER_STAGE, TEXTURE_USAGE } from '../constants.js';

import generateWGSL from './generators/ssao.wgsl.js';
import generateGLSL from './generators/ssao.glsl.js';
import { PRNG } from '../utils.js';


const KERNEL_SIZE = 64;
const NOISE_SIZE = 4;

class SSAOUniform extends UBO {
    static layout = new UBO.Layout([
        { name: 'kernel', type: 'vec3<f32>', count: KERNEL_SIZE },
    ]);
}

const pnrg = new PRNG(28173);

export class SSAOShader extends Shader {

    static wgsl = generateWGSL;
    static glsl = generateGLSL;

    constructor(gal, input) {
        super(gal, { 
            ...input,
            buffer: SSAOShader.createBuffer(gal),
            noise:  SSAOShader.createNoiseTexture(gal),
        });
    }

    async init() {
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
                { binding: 0, resource: gal.device.createSampler({ type: 'non-filtering' }) },
                { binding: 1, resource: point.texture.createView() },
                { binding: 2, resource: gal.device.createSampler({ type: 'non-filtering', addressModeU: 'repeat', addressModeV: 'repeat' }) },
                { binding: 3, resource: noise.createView() },
                { binding: 4, resource: buffer },
            ],
        });
        
        this.renderPipeline = gal.device.createRenderPipeline({
            label: 'SSAO',
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
                targets: [{ format: 'r8unorm' }],
            },
        });
    }

    static createBuffer(gal) {
        const kernel = [...Array(KERNEL_SIZE)].map((_, i) => {
            const scale = i / KERNEL_SIZE;
            const sample = vec3.fromValues((pnrg.nextFloat() * 2) - 1, (pnrg.nextFloat() * 2) - 1, pnrg.nextFloat());
            vec3.normalize(sample, sample);
            vec3.scale(sample, sample, SSAOShader.lerp(0.1, 1, scale * scale));
            return [sample[0], sample[1], sample[2]];
        });
        return new SSAOUniform(gal, { kernel });
    }

    static createNoiseTexture(gal) {
        const format = 'rg32float';
        const usage  = TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_DST;
        const size   = { width: NOISE_SIZE, height: NOISE_SIZE };
        const data   = new Float32Array([...Array(NOISE_SIZE * NOISE_SIZE)].map(() => {
            return [(pnrg.nextFloat() * 2) - 1, (pnrg.nextFloat() * 2) - 1];
        }).flat());
        return gal.createTextureWithData({ label: `SSAONoiseTexture`, format, usage, size, data });
    }

    static lerp (a, b, t) {
        t = t < 0 ? 0 : t;
        t = t > 1 ? 1 : t;
        return a + (b - a) * t;
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

export default SSAOShader;