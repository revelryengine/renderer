import { Program } from './program.js';
import { vec3    } from '../../utils/gl-matrix.js';

import { vertexShader   } from '../shaders/simple.vert.js';
import { fragmentShader } from '../shaders/ssao.frag.js';

export class SSAOProgram extends Program {
    static vertexShaderSrc = vertexShader;
    static fragmentShaderSrc = fragmentShader;

    constructor(context) {
        const kernel       = SSAOProgram.createKernel();
        const noiseTexture = SSAOProgram.createNoiseTexture(context);

        super(context, { defines: { 'SSAO_KERNEL_SIZE': kernel.length / 3 } });

        this.kernel       = kernel;
        this.noiseTexture = noiseTexture;
    }

    run({ frustum, input, output }) {
        super.run();

        const { context: gl } = this;

        const { noiseTexture, kernel } = this;

        const { point, radius, bias } = input;

        const noiseScale = [output.ssao.width / 4, output.ssao.height / 4];

        this.uniforms.set('u_NoiseSampler', noiseTexture);
        this.uniforms.set('u_PointSampler', point.glTexture);

        this.uniforms.set('u_NoiseScale', noiseScale);
        this.uniforms.set('u_Kernel',     kernel);

        this.uniforms.set('u_Radius', radius);
        this.uniforms.set('u_Bias',   bias);

        this.uniforms.set('u_Frustum', frustum);
        
        this.update();

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 3);
    }

    static createKernel(size = 64) {
        return new Float32Array([...Array(size)].map((_, i) => {
            const scale = i / size;
            const sample = vec3.fromValues((Math.random() * 2) - 1, (Math.random() * 2) - 1, Math.random());
            vec3.normalize(sample, sample);
            vec3.scale(sample, sample, SSAOProgram.lerp(0.1, 1, scale * scale));
            return [sample[0], sample[1], sample[2]];
        }).flat());
    }

    static createNoiseTexture(context, size = 4) {
        const gl = context;

        const noise = new Float32Array([...Array(size * size)].map(() => {
            const noise = vec3.fromValues((Math.random() * 2) - 1, (Math.random() * 2) - 1, 0);
            vec3.normalize(noise, noise);
            return [noise[0], noise[1], noise[2], 0];
        }).flat());

        const texture = gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);  
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, size, size, 0, gl.RGBA, gl.FLOAT, noise);
        gl.bindTexture(gl.TEXTURE_2D, null);

        return texture;
    }

    static lerp (a, b, t) {
        t = t < 0 ? 0 : t;
        t = t > 1 ? 1 : t;
        return a + (b - a) * t;
    }
}

export default SSAOProgram;