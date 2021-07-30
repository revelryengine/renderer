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
    static type = 'screen';

    static program = SSAOProgram;

    static scaleFactor = 0.5;

    static input = {
        normal: { type: 'texture' },
        depth:  { type: 'texture' },
    }

    static output = {
        ssao: { type: 'texture', attachmentType: 'color', params: { format: GL.RED, internalFormat: GL.R8 } },
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

    clearProgramCache() {
        super.clearProgramCache();
        this.gaussian?.clearProgramCache();
    }
}

export default SSAONode;