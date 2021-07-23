import { RenderPass  } from './render-pass.js';
import { BaseProgram } from '../programs/base-program.js';

/**
 * The Base Pass is responsible for capturing the linear output of all opaque objects along with depth and normals.
 */
export class BasePass extends RenderPass {
    static type = 'geometry';
    static opaque = true;

    static program = BaseProgram;

    static output = {
        scaleFactor: 0.5,
        textures: [
            { name: 'color' , type: 'color' },
            { name: 'normal', type: 'color' },
            { name: 'depth',  type: 'depth' },
        ],
    }

    render(graph) {
        graph.primitives.sort((a, b) => {
            return (!!a.primitive.material?.extensions.KHR_materials_transmission - !!b.primitive.material?.extensions.KHR_materials_transmission) 
                    || (b.opaque - a.opaque) || (b.depth - a.depth);
        });
        return super.render(...arguments);
    }
}

export default BasePass;