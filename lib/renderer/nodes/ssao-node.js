import { RenderNode   } from './render-node.js';
import { GaussianNode } from './gaussian-node.js';
import { SSAOProgram  } from '../programs/ssao-program.js';

const GL = WebGL2RenderingContext;

/**
 * The SSAO Node is responsible for generating a screen space ambient occlusion texture from the Base Node
 * 
 * @todo: if ssao disabled, don't create textures or framebuffers
 */
export class SSAONode extends RenderNode {
    type = 'screen';

    program = SSAOProgram;

    scaleFactor = 0.5;

    textures = [
        { name: 'ssao', type: 'color', params: { format: GL.RED, internalFormat: GL.R8 } },
    ]

    input = {
        normal: { type: 'texture' },
        depth:  { type: 'texture' },
    }

    output = {
        ssao: { type: 'texture' },
    }
    
    gaussian = new GaussianNode(this.pipeline, { bilateral: true });

    render(graph, input) {
        if(!graph.settings.ssao.enabled) return { skipped: true };
        const { radius, bias } = graph.settings.ssao;

        super.render(graph, { ...input, radius, bias });

        this.gaussian.render(graph, { color: this.output.ssao, passes: 3 });
        
        this.blitFramebuffer(this.gaussian, this);

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

export default SSAONode;