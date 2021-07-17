import { Program } from './program.js';

import vertexShader from '../shaders/simple.vert.js';
import fragmentShader from '../shaders/ssao.frag.js';

export class SSAOProgram extends Program {
    static vertexShaderSrc = vertexShader;
    static fragmentShaderSrc = fragmentShader;

    constructor(context, { noiseTexture, kernel }) {
        super(context, { 'SSAO_KERNEL_SIZE': kernel.length / 3 });
        this.noiseTexture = noiseTexture;
        this.kernel = kernel;
    }

    run(graph, noiseScale) {
        super.run();

        const { context: gl } = this;

        this.uniforms.set('u_NoiseSampler', this.noiseTexture);

        const { depthTexture, normalTexture, positionTexture } = graph.passes.pre;

        this.uniforms.set('u_DepthSampler', depthTexture);
        this.uniforms.set('u_NormalSampler', normalTexture);
        this.uniforms.set('u_PositionSampler', positionTexture);

        this.uniforms.set('u_NoiseScale', noiseScale);
        this.uniforms.set('u_Kernel', this.kernel);
        this.uniforms.set('u_Radius', 0.5);
        this.uniforms.set('u_Bias', 0.05);

        this.uniforms.set('u_ZFar', graph.zfar);
        this.uniforms.set('u_ZNear', graph.znear);

        this.uniforms.set('u_HalfSizeNearPlane', graph.halfSizeNearPlane);

        this.uniforms.set('u_ViewMatrix', graph.viewMatrix);
        this.uniforms.set('u_ViewProjectionMatrix', graph.viewProjectionMatrix);
        this.uniforms.set('u_ProjectionMatrix', graph.projectionMatrix);
        this.uniforms.set('u_InverseViewProjectionMatrix', graph.inverseViewProjectionMatrix);

        this.update();

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 3);
    }
}

export class SSAOBlurProgram extends Program {
    static vertexShaderSrc = vertexShader;
    static fragmentShaderSrc = fragmentShader;

    constructor(context, { noiseTexture, kernel }) {
        super(context, { 'SSAO_KERNEL_SIZE': kernel.length / 3 });
        this.noiseTexture = noiseTexture;
        this.kernel = kernel;
    }

    run(graph, noiseScale) {
        super.run();

        const { context: gl } = this;

        this.uniforms.set('u_NoiseSampler', this.noiseTexture);

        const { depthTexture, normalTexture, positionTexture } = graph.passes.pre;

        this.uniforms.set('u_DepthSampler', depthTexture);
        this.uniforms.set('u_NormalSampler', normalTexture);
        this.uniforms.set('u_PositionSampler', positionTexture);

        this.uniforms.set('u_NoiseScale', noiseScale);
        this.uniforms.set('u_Kernel', this.kernel);
        this.uniforms.set('u_Radius', 0.5);
        this.uniforms.set('u_Bias', 0.05);

        this.uniforms.set('u_ZFar', graph.zfar);
        this.uniforms.set('u_ZNear', graph.znear);

        this.uniforms.set('u_HalfSizeNearPlane', graph.halfSizeNearPlane);

        this.uniforms.set('u_ViewMatrix', graph.viewMatrix);
        this.uniforms.set('u_ViewProjectionMatrix', graph.viewProjectionMatrix);
        this.uniforms.set('u_ProjectionMatrix', graph.projectionMatrix);
        this.uniforms.set('u_InverseViewProjectionMatrix', graph.inverseViewProjectionMatrix);

        this.update();

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 3);
    }
}

export default SSAOProgram;