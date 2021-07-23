import { RenderPass  } from './render-pass.js';
import { GaussianProgram } from '../programs/gaussian-program.js';

/**
 * The Gaussian Directional Pass is responsible for blurring the previous pass using gaussian blur in a single direction (3-tap).
 * Run a second BilateralPass in the opposite direction for full 9-tap
 * 
 * Previous pass must output a texture named `color`.
 */
 export class GaussianDirectionalPass extends RenderPass {
    static type = 'screen';

    static program = GaussianProgram;

    static output = {
        scaleFactor: 0.5,
        textures: [
            { name: 'color', type: 'color' },
        ],
    }

    constructor(name, context, { direction, bilateral }){
        super(name, context);
        this.direction = direction;
        this.bilateral = bilateral;
    }

    render(graph) {
        if(graph.passes[RenderPass.previous].skipped) return { skipped: true };
        return super.render(...arguments);
    }
}

/**
 * The Guassian Pass is responsible for blurring the previous pass using guassian blur in a double pass (9-tap).
 * 
 * Previous pass must output a texture named `color`.
 */
export class GaussianPass extends GaussianDirectionalPass {

    postprocess = [
        new GaussianDirectionalPass(`${this.name}:horizontal`, this.context, { direction: 'horizontal', bilateral: this.bilateral }),
    ];

    constructor(name, context, { passes = 1, bilateral = false }){
        super(name, context, { direction: 'vertical', bilateral });
        this.passes = passes;
    }

    render(graph) {
        if(graph.passes[RenderPass.previous].skipped) return { skipped: true };

        let count = this.passes;
        while(count--) {
            graph.passes[RenderPass.previous] = super.render(graph);
        }

        return graph.passes[RenderPass.previous];
    }
}

export default GaussianPass;