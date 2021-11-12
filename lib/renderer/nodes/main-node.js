import { GeometryNode    } from './render-node.js';
import { MSFBO           } from '../fbo.js';
import { MaterialProgram } from '../programs/gltf/material-program.js';
import { GridProgram     } from '../programs/grid-program.js';

const GL = WebGL2RenderingContext;

/**
 * The Main Node is responsible for rendering the full output as defined by the glTF spec.
 */
export class MainNode extends GeometryNode {

    program = MaterialProgram;

    lighting = true;

    fbo = new MSFBO(this.pipeline.context, {
        colors: [
            { name: 'color',  mipmaps: true, params: { format: GL.RGBA, internalFormat: GL.RGBA32F , type: GL.FLOAT, renderFormat: GL.RGBA32F } },
        ],
        depth: { name: 'depth' },
    })

    input = {
        ssao:         { type: 'texture' },
        transmission: { type: 'texture' },
    }

    output = {
        color:  { type: 'texture' },
        depth:  { type: 'texture' },
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

    clear() {
        /** @todo handle this automatically in the RenderNode */
        const { context: gl } = this.pipeline;

        for(const framebuffer of [this.fbo.framebuffer, this.fbo.unresolved.framebuffer]) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            gl.viewport(0, 0, this.width, this.height);
            
            gl.clearBufferfv(gl.COLOR,  0, [0,0,0,0]);
            gl.clear(gl.DEPTH_BUFFER_BIT);
        }
    }
}

export default MainNode;