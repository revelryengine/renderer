import { GaussianShader } from '../shaders/gaussian-shader.js';
import { RenderNode     } from './render-node.js';

/**
 * The GaussianNode is responsible for applying a gaussian blur.
 */
export class GaussianNode extends RenderNode {
    attachments = {
        colors: [
            { name: 'blurA' },
            { name: 'blurB' },
        ],
    }

    path = [];

    constructor(renderer, { passes = 9, bilateral = false } = {}) {
        super(renderer);
        this.passes    = passes;
        this.bilateral = bilateral;
    }
    
    reconfigure({ input }) {
        super.reconfigure();

        this.input = input;
        this.output.color = this.output.blurB;

        // renderpasses
        // source -> dest
        //
        // input -> blurA 
        // blurA -> blurB
        // blurB -> blurA
        // blurA -> blurB

        const first      = { output: this.output.blurA, shader: new GaussianShader(this.gal, { color: this.input,        horizontal: true,  bilateral: this.bilateral }) };
        const vertical   = { output: this.output.blurB, shader: new GaussianShader(this.gal, { color: this.output.blurA, horizontal: false, bilateral: this.bilateral }) };
        const horizontal = { output: this.output.blurA, shader: new GaussianShader(this.gal, { color: this.output.blurB, horizontal: true,  bilateral: this.bilateral }) };

        this.path = [first, vertical];

        for(let i = 1; i < this.passes; i++) {
            this.path.push(horizontal);
            this.path.push(vertical);
        }
    }

    begin(commandEncoder, { output }) {
        return commandEncoder.beginRenderPass({
            label: this.constructor.name,
            colorAttachments: [
                {
                    view       : output.texture.createView(),
                    storeOp    : 'store',
                    loadOp     : 'clear',
                    clearValue : [0, 0, 0, 0],
                }
            ]
        });
    }

    render(renderPassEncoder, { shader }) {
        shader.run(renderPassEncoder);
    }

    run(commandEncoder) {
        for(const { output, shader } of this.path){
            super.run(commandEncoder, { shader, output });
        }
    }
}