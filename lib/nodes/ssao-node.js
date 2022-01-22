import { RenderNode   } from './render-node.js';
import { FBO          } from '../fbo.js';
import { GaussianNode } from './gaussian-node.js';
import { SSAOProgram  } from '../programs/ssao-program.js';

const GL = WebGL2RenderingContext;

/**
 * The SSAO Node is responsible for generating a screen space ambient occlusion texture from the Base Node
 * 
 * @todo: if ssao disabled, don't create textures or framebuffers
 */
export class SSAONode extends RenderNode {
    program = SSAOProgram;

    scaleFactor = 0.5;

    fbo = new FBO(this.pipeline.context, {
        colors: [
            { name: 'ssao', mipmaps: true,  params: { format: GL.RED, internalFormat: GL.R8 } },
        ],
    })

    input = {
        point: { type: 'texture' },
    }

    output = {
        ssao: { type: 'texture' },
    }
    
    gaussian = new GaussianNode(this.pipeline, { bilateral: true });

    run({ graph, frustum, input }) {
        if(!this.pipeline.settings.ssao.enabled) return;
        return super.run({ graph, frustum, input: { ...input, ...this.pipeline.settings.ssao } });
    }

    finish({ graph, frustum, input }) {
        super.finish({ graph, frustum, input });
        this.gaussian.run({ graph, frustum, input: { color: this.output.ssao, passes: 3 } });
        this.gaussian.fbo.blitFramebuffer(this.fbo);
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