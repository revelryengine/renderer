import { RenderNode   } from './render-node.js';
import { GaussianNode } from './gaussian-node.js';
import { DOFProgram   } from '../programs/dof-program.js';
import { FBO          } from '../fbo.js';

/**
 * The DOF Node is responsible for applying a depth of field effect. 
 */
export class DOFNode extends RenderNode {
    program = DOFProgram;

    scaleFactor = 1;

    gaussian = new GaussianNode(this.pipeline, { bilateral: false });
    
    fbo = new FBO(this.pipeline.context, {
        colors: [
            { name: 'color' },
        ],
    })

    input = {
        color: { type: 'texture' },
        depth: { type: 'texture' },
    }

    output = {
        color:  { type: 'texture' },
    }

    run({ graph, frustum, input }) {
        if(!this.pipeline.settings.dof.enabled) return;

        this.gaussian.run({ graph, frustum, input: { color: input.color, passes: 2 } });

        const { depth, color: inFocus } = input;
        const { color: outFocus       } = this.gaussian.output;
        const { distance, range       } = this.pipeline.settings.dof;

        return super.run({ graph, frustum, input: { distance, range, inFocus, outFocus, depth } });
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