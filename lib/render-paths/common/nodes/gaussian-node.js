import { ColorAttachment, RenderNode } from '../../render-node.js';

import { Gaussian, GaussianShader } from '../shaders/gaussian-shader.js';

import { NonNull } from '../../../../deps/utils.js';

/**
 * The GaussianNode is responsible for applying a gaussian blur.
 */
export class GaussianNode extends RenderNode {
    attachments = {
        colors: {
            color: new ColorAttachment(),
        },
    }

    layers = 2;

    /**
     * @param {import('../../render-path.js').RenderPath} renderPath
     */
    constructor(renderPath, { passes = 9, bilateral = false } = {}) {
        super(renderPath);
        this.passes    = passes;
        this.bilateral = bilateral;
    }

    /**
     * @type {{
     *  horizontal: import('../../../revgal.js').REVBindGroup,
     *  vertical: import('../../../revgal.js').REVBindGroup,
     * }[]}
     */
    bindGroups = [];

    /**
     * @param {{ input: ColorAttachment }} config
     */
    reconfigure({ input }) {
        this.attachments.colors.color.format = input.format;

        super.reconfigure();

        // renderpasses
        // source -> dest
        //
        // input  -> layer1
        // layer1 -> layer0
        // layer0 -> layer1
        // layer1 -> layer0

        const horizontal = new Gaussian(this.gal, { direction: [1, 0] });
        const vertical   = new Gaussian(this.gal, { direction: [0, 1] });
        const sampler    = this.gal.device.createSampler({ minFilter: 'linear', magFilter: 'linear' });
        const layout     = this.gal.device.createBindGroupLayout(GaussianShader.bindGroupLayoutDescriptor);

        this.bindGroups.length = 0;
        for(let i = 0; i < this.passes; i++) {

            this.bindGroups.push({
                horizontal: this.gal.device.createBindGroup({
                    label: `Gaussian (pass ${i} horizontal)`,
                    layout,
                    entries: [
                        { binding: 0, resource: sampler },
                        { binding: 1, resource: NonNull((i === 0 ? input : this.attachments.colors.color).texture).createView({ dimension: '2d', baseArrayLayer: 0, arrayLayerCount: 1 }) },
                        { binding: 2, resource: { buffer: horizontal.buffer } },
                    ],
                }),
                vertical: this.gal.device.createBindGroup({
                    label: `Gaussian (pass ${i} vertical)`,
                    layout,
                    entries: [
                        { binding: 0, resource: sampler },
                        { binding: 1, resource: NonNull(this.attachments.colors.color.texture).createView({ dimension: '2d', baseArrayLayer: 1, arrayLayerCount: 1 }) },
                        { binding: 2, resource: { buffer: vertical.buffer } },
                    ],
                })
            });
        }

        horizontal.upload();
        vertical.upload();

        this.shader = new GaussianShader(this.gal, { bilateral: this.bilateral, format: input.format }).compile();
    }

    /**
     * @type {RenderNode['run']}
     */
    run(commandEncoder) {
        let renderPassEncoder;
        for(const { horizontal, vertical } of this.bindGroups) {
            this.setRenderLayer(1);
            renderPassEncoder = this.begin(commandEncoder);
            renderPassEncoder.setBindGroup(0, horizontal);
            this.shader?.run(renderPassEncoder);
            this.end(renderPassEncoder);

            this.setRenderLayer(0);
            renderPassEncoder = this.begin(commandEncoder);
            renderPassEncoder.setBindGroup(0, vertical);
            this.shader?.run(renderPassEncoder);
            this.end(renderPassEncoder);
        }
    }
}
