


import { GeometryNode     } from './render-node.js';
import { SolidProgram     } from '../programs/solid-program.js';
import { WireframeProgram } from '../programs/wireframe-program.js';
import { OutputProgram    } from '../programs/output-program.js';
import { MSFBO            } from '../fbo.js'

/**
 * The Highlight Node is responsible for rendering a highlight around nodes defined in scene.extras.highlights.
 */
export class HighlightNode extends GeometryNode {
    program = SolidProgram;

    fbo = new MSFBO(this.pipeline.context, {
        colors: [{ name: 'color' }],
        stencil: { name: 'stencil' },
    })

    input = {
        color: { type: 'color' },
    }

    output = {
        color: { type: 'texture' },
    }

    #wireframePrograms = new WeakMap();
    #outputProgram     = new OutputProgram(this.pipeline.context);

    run({ graph, frustum, input = {} }) {
        const { context: gl } = this.pipeline;

        if(!graph.scene.extras?.highlights) return;

        this.start({ graph, frustum, input });

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

        this.#outputProgram.run({ graph, frustum, input });

        gl.enable(gl.BLEND);

        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.blendEquation(gl.FUNC_ADD);

        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.STENCIL_TEST);

        for(const { node: highlightNode , stroke = [1, 1, 1, 1], fill = [0, 0, 0, 0] } of graph.scene.extras.highlights) {
            gl.clear(gl.STENCIL_BUFFER_BIT);

            gl.stencilFunc(gl.ALWAYS, 1, 0xFF);
            gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);

            for(const node of highlightNode.depthFirstSearch()) {
                const { mesh } = node;
                if(mesh) {
                    for (const primitive of mesh.primitives) {
                        const program = this.getProgram({ graph, primitive, node });
                        program.runSingle({ graph, primitive, node, frustum, input: { color: fill } });
                    }
                }
            }

            gl.stencilFunc(gl.EQUAL, 0, 0xFF);
            gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

            for(const node of highlightNode.depthFirstSearch()) {
                const { mesh } = node;
                if(mesh) {
                    for (const primitive of mesh.primitives) {
                        const program = this.getWireframeProgram({ graph, primitive, node });
                        program.runSingle({ graph, primitive, node, frustum, input: { color: stroke } });
                    }
                }
            }
        }

        gl.disable(gl.STENCIL_TEST);

        return this.finish({ graph, frustum, input });
    }

    createWireframeProgram({ graph, primitive, node }) {
        return new WireframeProgram(this.pipeline.context, { graph, primitive, node, settings: this.pipeline.settings });
    }

    renderWireframe({ graph, primitive, node, frustum, input }) {
        const program = this.getWireframeProgram({ graph, primitive, node });
        program.run({ graph, primitive, node, frustum, input });
    }
    
    getWireframeProgram({ graph, primitive, node }) {
        return this.#wireframePrograms.get(primitive) || this.#wireframePrograms.set(primitive, this.createWireframeProgram({ graph, primitive, node })).get(primitive);
    }
}

export default HighlightNode;