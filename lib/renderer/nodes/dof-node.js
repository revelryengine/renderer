import { RenderNode   } from './render-node.js';
import { GaussianNode } from './gaussian-node.js';
import { DOFProgram  } from '../programs/dof-program.js';

/**
 * The DOF Node is responsible for applying a depth of field effect. 
 */
export class DOFNode extends RenderNode {
    type = 'screen';

    program = DOFProgram;

    scaleFactor = 1;

    gaussian = new GaussianNode(this.pipeline, { bilateral: false });

    textures = [
        { name: 'color', type: 'color' },
    ]

    input = {
        color: { type: 'texture' },
        depth: { type: 'texture' },
    }

    output = {
        color:  { type: 'texture' },
    }

    render(graph, input) {
        if(!graph.settings.dof.enabled) return { skipped: true };

        this.gaussian.render(graph, { color: input.color, passes: 2 });

        const { depth, color: inFocus } = input;
        const { color: outFocus       } = this.gaussian.output;
        const { distance, range       } = graph.settings.dof;

        super.render(graph, { distance, range, inFocus, outFocus, depth });

        return this.output;
    }

    resize({ width, height }){
        super.resize({ width, height });
        this.gaussian.resize({ width: this.width, height: this.height });
    }

    reset() {
        super.reset();
        this.gaussian?.reset();
    }
}

export default DOFNode;