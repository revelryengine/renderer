import { RenderPass  } from './render-pass.js';
import { SSAOProgram } from '../programs/ssao-program.js';
import { BlurProgram } from '../programs/blur-program.js';
import { vec3        } from '../../utils/gl-matrix.js';

function lerp (a, b, t) {
    t = t < 0 ? 0 : t;
    t = t > 1 ? 1 : t;
    return a + (b - a) * t;
}

/**
 * The SSAO Pass is responsible for generating a screen space ambient occlusion texture from the Pre Pass
 */
export class SSAOPass extends RenderPass {
    constructor(context) {
        super('ssao', context, { scaleFactor: 0.5, powerOf2: true });

        this.noise = new Float32Array([...Array(16)].map(() => {
            const noise = vec3.fromValues((Math.random() * 2) - 1, (Math.random() * 2) - 1, 0);
            vec3.normalize(noise, noise);
            return [noise[0], noise[1], noise[2], 0];
        }).flat());
    
        this.kernel = new Float32Array([...Array(64)].map((_, i) => {
            const scale = i / 64;
            const sample = vec3.fromValues((Math.random() * 2) - 1, (Math.random() * 2) - 1, Math.random());
            vec3.normalize(sample, sample);
            vec3.scale(sample, sample, lerp(0.1, 1, scale * scale));
            return [sample[0], sample[1], sample[2]];
        }).flat());

        const gl = context;

        this.ssaoTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.ssaoTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,     gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,     gl.CLAMP_TO_EDGE);

        this.blurTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.blurTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,     gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,     gl.CLAMP_TO_EDGE);

        this.noiseTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.noiseTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);  
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 4, 4, 0, gl.RGBA, gl.FLOAT, this.noise);
        gl.bindTexture(gl.TEXTURE_2D, null);

        this.framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.ssaoTexture, 0);

        gl.drawBuffers([gl.COLOR_ATTACHMENT0]);

        this.blurFramebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFramebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.blurTexture, 0);

        gl.drawBuffers([gl.COLOR_ATTACHMENT0]);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        this.program = new SSAOProgram(context, { noiseTexture: this.noiseTexture, kernel: this.kernel });
        this.blurProgram = new BlurProgram(context, { input: this.ssaoTexture });
    }

    resize() {
        super.resize(...arguments);

        const { context: gl, ssaoTexture, blurTexture, framebuffer, blurFramebuffer, viewport } = this;
        const { width, height } = viewport.scaled;

        gl.bindTexture(gl.TEXTURE_2D, ssaoTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        gl.bindTexture(gl.TEXTURE_2D, blurTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        gl.bindTexture(gl.TEXTURE_2D, null);

        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.viewport(0, 0, width, height);
        gl.clear(gl.COLOR_BUFFER_BIT); 
        gl.disable(gl.DEPTH_TEST);

        let status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if(status != gl.FRAMEBUFFER_COMPLETE){
            console.warn('SSAO framebuffer error:', RenderPass.GL_FRAMEUBUFFER_STATUS_ERRORS[status]);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, blurFramebuffer);
        gl.viewport(0, 0, width, height);
        gl.clear(gl.COLOR_BUFFER_BIT); 

        status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if(status != gl.FRAMEBUFFER_COMPLETE){
            console.warn('SSAO blur framebuffer error:', RenderPass.GL_FRAMEUBUFFER_STATUS_ERRORS[status]);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        return { ssaoTexture, blurTexture, framebuffer, blurFramebuffer, ...viewport.scaled }
    }


    render(graph) {
        const { context: gl, ssaoTexture, blurTexture, framebuffer, blurFramebuffer, viewport } = this;

        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.clear(gl.COLOR_BUFFER_BIT);    
        gl.viewport(0, 0, viewport.scaled.width, viewport.scaled.height);
        gl.disable(gl.DEPTH_TEST);

        this.program.run(graph, [viewport.scaled.width / 4, viewport.scaled.height / 4]);

        gl.viewport(0, 0, viewport.width, viewport.height);
        gl.bindTexture(gl.TEXTURE_2D, ssaoTexture);
        gl.generateMipmap(gl.TEXTURE_2D);

        gl.bindFramebuffer(gl.FRAMEBUFFER, blurFramebuffer);
        gl.clear(gl.COLOR_BUFFER_BIT);    
        gl.viewport(0, 0, viewport.scaled.width, viewport.scaled.height);
        gl.disable(gl.DEPTH_TEST);

        this.blurProgram.run();

        gl.viewport(0, 0, viewport.width, viewport.height);
        gl.bindTexture(gl.TEXTURE_2D, blurTexture);
        gl.generateMipmap(gl.TEXTURE_2D);
        
        return { ssaoTexture, blurTexture, framebuffer, blurFramebuffer, ...viewport.scaled };
    }

    clearProgramCache() {
        this.program = new SSAOProgram(this.context, { noiseTexture: this.noiseTexture, kernel: this.kernel });
    }
}

export default SSAOPass;