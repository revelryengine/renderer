import { RenderNode   } from './render-node.js';
import { GaussianNode } from './gaussian-node.js';
import { Program      } from '../programs/program.js';
import { vertexShader } from '../shaders/simple.vert.js';
import { FBO          } from '../fbo.js';

const glsl = String.raw; // For syntax-highlighting

class BloomExtractProgram extends Program {
    static vertexShaderSrc   = vertexShader;
    static fragmentShaderSrc = glsl`
        /********** bloom-extract.frag.js **********/
        precision highp float;
        
        /*layout(binding = 0)*/uniform sampler2D u_ColorSampler;
        
        in vec2 v_TexCoord;
        
        out vec4 g_finalColor;
        
        void main(void) {
            vec4 color = texture(u_ColorSampler, v_TexCoord);
            float value = max(color.r, max(color.g, color.b));
            if(value < 1.0) color = vec4(0.0);
            g_finalColor = color;
        }
        /********** /bloom-extract.frag.js **********/
    `;
    run({ input }) {
        super.run();

        const { context: gl } = this;

        this.samplers.set('u_ColorSampler',  input.color.glTexture);

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 3);
    }
}

class BloomExtractNode extends RenderNode {
    program = BloomExtractProgram;

    fbo = new FBO(this.pipeline.context, {
        colors: [
            { name: 'color' },
        ],
    })

    input = {
        color:  { type: 'texture' },
    }

    output = {
        color:  { type: 'texture' },
    }
}

class BloomMixProgram extends Program {
    static vertexShaderSrc   = vertexShader;
    static fragmentShaderSrc = glsl`
        /********** bloom-extract.frag.js **********/
        precision highp float;
        
        /*layout(binding = 0)*/uniform sampler2D u_ColorSampler;
        /*layout(binding = 1)*/uniform sampler2D u_BloomSampler;
        
        in vec2 v_TexCoord;
        
        out vec4 g_finalColor;
        
        void main(void) {
            vec4 color = texture(u_ColorSampler, v_TexCoord);
            vec4 bloom = texture(u_BloomSampler, v_TexCoord);
            g_finalColor = color + bloom;
        }
        /********** /bloom-extract.frag.js **********/
    `;
    run({ input }) {
        super.run();

        const { context: gl } = this;

        this.samplers.set('u_ColorSampler',  input.color.glTexture);
        this.samplers.set('u_BloomSampler',  input.bloom.glTexture);

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 3);
    }
}



/**
 * The Bloom Node is responsible for applying a bloom effect. 
 */
export class BloomNode extends RenderNode {
    program = BloomMixProgram;

    scaleFactor = 1;

    extract  = new BloomExtractNode(this.pipeline);
    gaussian = new GaussianNode(this.pipeline, { bilateral: false });

    
    fbo = new FBO(this.pipeline.context, {
        colors: [
            { name: 'color' },
        ],
    })

    input = {
        color:  { type: 'texture' },
    }

    output = {
        color:  { type: 'texture' },
    }

    run({ graph, frustum, input }) {
        if(!this.pipeline.settings.bloom.enabled) return;

        this.extract.run({ graph, frustum, input: { color: input.color } });
        this.gaussian.run({ graph, frustum, input: { color: this.extract.output.color, passes: 5 } });

        return super.run({ graph, frustum, input: { color: input.color, bloom: this.gaussian.output.color } });
    }

    resize({ width, height }){
        super.resize({ width, height });
        this.extract.resize({ width: this.width, height: this.height });
        this.gaussian.resize({ width: this.width, height: this.height });
    }

    reset() {
        super.reset();
        this.extract?.reset();
        this.gaussian?.reset();
    }
}

export default BloomNode;