import { RenderNode    } from './render-node.js';
import { AABBProgram   } from '../programs/aabb-program.js';
import { OutputProgram } from '../programs/output-program.js';
import { MSFBO         } from '../fbo.js';

/**
 * The AABB Node is responsible for rendering axis aligned bounding boxes for all primitives. 
 * This is useful for debugging purposes.
 */
export class AABBNode extends RenderNode {
    program = AABBProgram;

    scaleFactor = 1;
    
    fbo = new MSFBO(this.pipeline.context, {
        colors: [
            { name: 'color' },
        ],
        depth: { name: 'depth' },
    })

    output = {
        color:  { type: 'texture' },
    }

    #outputProgram = new OutputProgram(this.pipeline.context);

    run({ graph, input, frustum }) {
        if(!this.pipeline.settings.aabb.enabled) return;
        return super.run({ graph, input, frustum });
    }
    render({ graph, input, frustum }) {
        this.#outputProgram.run({ graph, frustum, input });
        super.render({ graph, frustum });
    }
}

export default AABBNode;