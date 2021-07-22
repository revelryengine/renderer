import { RenderPass  } from './render-pass.js';
import { SSAOProgram } from '../programs/ssao-program.js';
import { vec3        } from '../../utils/gl-matrix.js';

function lerp (a, b, t) {
    t = t < 0 ? 0 : t;
    t = t > 1 ? 1 : t;
    return a + (b - a) * t;
}

/**
 * The SSAO Pass is responsible for generating a screen space ambient occlusion texture from the Pre Pass
 * 
 * @todo: if ssao disabled, don't create textures or framebuffers
 */
export class SSAOPass extends RenderPass {
    static type = 'screen';

    static program = SSAOProgram;

    static output = {
        scaleFactor: 0.5, powerOf2: true,
        textures: [
            { name: 'color', type: 'color', mipmaps: true },
        ],
    }

    kernel       = this.createKernel();
    noiseTexture = this.createNoiseTexture();

    render(graph) {
        if(!graph.settings.ssao.enabled) return { skipped: true };
        return super.render(...arguments);
    }

    createKernel(size = 64) {
        return new Float32Array([...Array(size)].map((_, i) => {
            const scale = i / size;
            const sample = vec3.fromValues((Math.random() * 2) - 1, (Math.random() * 2) - 1, Math.random());
            vec3.normalize(sample, sample);
            vec3.scale(sample, sample, lerp(0.1, 1, scale * scale));
            return [sample[0], sample[1], sample[2]];
        }).flat());
    }

    createNoiseTexture(size = 4) {
        const { context: gl } = this;

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

}

export default SSAOPass;