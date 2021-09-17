import { GeometryNode } from './render-node.js';
import { MSFBO        } from '../fbo.js';
import { GLTFProgram  } from '../programs/gltf/gltf-program.js';
import { GridProgram  } from '../programs/grid-program.js';

/**
 * The GLTF Node is responsible for rendering the full output as defined by the glTF spec.
 */
export class GLTFNode extends GeometryNode {

    program = GLTFProgram;

    lighting = true;

    fbo = new MSFBO(this.pipeline.context, {
        colors: [{ name: 'color' }],
        depth: { name: 'depth' },
    })

    input = {
        ssao:         { type: 'texture' },
        transmission: { type: 'texture' },
    }

    output = {
        color:   { type: 'texture' },
        depth:   { type: 'texture' },
    }

    #gridProgram = new GridProgram(this.pipeline.context);
    render({ graph, frustum, input }) {
        super.render({ graph, frustum, input });

        if(this.pipeline.settings.grid.enabled) {
            const { context: gl } = this.pipeline;
            gl.disable(gl.CULL_FACE);
            gl.enable(gl.BLEND);
            gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.blendEquation(gl.FUNC_ADD);
            this.#gridProgram.run({ graph, frustum, input: this.pipeline.settings.grid });
            gl.disable(gl.BLEND);
        }
    }
}

export default GLTFNode;