import { RenderPass } from './render-pass.js';
import { PBRProgram } from '../programs/pbr-program.js';

/**
 * The Main Pass is responsible for rendering the full PBR output.
 */
export class MainPass extends RenderPass {
    constructor(context) {
        super('main', context, { scaleFactor: 1, powerOf2: false });
    }

    render(graph) {
        const { context: gl, viewport } = this;

        const { width, height } = viewport.scaled;

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.viewport(0, 0, width, height);
        gl.enable(gl.DEPTH_TEST);

        for(const { primitive, node } of graph.primitives) {
            this.renderPrimitive(primitive, node, graph);
        }

        return { width, height };
    }

    createPrimitiveProgram(primitive, node, graph) {
        const program = new PBRProgram(this.context, primitive, node, graph, {
            USE_IBL:      graph.useIBL ? 1 : null,
            USE_PUNCTUAL: graph.usePunctual ? 1 : null,
            USE_SSAO    : graph.useSSAO  ? 1 : null,
            DEBUG:        graph.debug || 'DEBUG_NONE',
        });
        return program;
    }
}

export default MainPass;