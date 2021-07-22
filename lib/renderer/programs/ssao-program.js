import { Program } from './program.js';

import { vertexShader   } from '../shaders/simple.vert.js';
import { fragmentShader } from '../shaders/ssao.frag.js';
import { RenderPass     } from '../passes/render-pass.js';

export class SSAOProgram extends Program {
    static vertexShaderSrc = vertexShader;
    static fragmentShaderSrc = fragmentShader;

    constructor(context, graph, { kernel }) {
        super(context, { 'SSAO_KERNEL_SIZE': kernel.length / 3 });
        this.kernel = kernel;
    }

    run(graph, pass) {
        super.run();

        const { context: gl } = this;

        const { noiseTexture, kernel } = pass;

        const { depth: depthTexture, normal: normalTexture } = graph.passes[RenderPass.previous].textures;

        const { projectionMatrix, invProjectionMatrix } = graph.viewInfo;

        const noiseScale = [pass.output.width / 4, pass.output.height / 4];

        this.uniforms.set('u_NoiseSampler', noiseTexture);
        this.uniforms.set('u_DepthSampler', depthTexture);
        this.uniforms.set('u_NormalSampler', normalTexture);

        this.uniforms.set('u_NoiseScale', noiseScale);
        this.uniforms.set('u_Kernel', kernel);
        this.uniforms.set('u_Radius', graph.settings.ssao.radius);
        this.uniforms.set('u_Bias', graph.settings.ssao.bias);

        this.uniforms.set('u_ProjectionMatrix', projectionMatrix);
        this.uniforms.set('u_InverseProjectionMatrix', invProjectionMatrix);
        
        this.update();

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 3);
    }
}

export default SSAOProgram;