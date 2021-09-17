import { Program } from './program.js';

import { vertexShader   } from '../shaders/grid.vert.js';
import { fragmentShader } from '../shaders/grid.frag.js';

export class GridProgram extends Program {
    static vertexShaderSrc   = vertexShader;
    static fragmentShaderSrc = fragmentShader;
    static uniformBindings   = { Frustum: 0 };

    run({ frustum, input }) {
        super.run();

        const { context: gl } = this;

        const { 
            extent = frustum.far / 2,
            increment = 0.1,
            colors: {
                thick = [1, 1, 1, 0.5], 
                thin  = [0.5, 0.5, 0.5, 0.5], 
            },
        }  = input;


        this.uniforms.set('u_ColorThick', thick);
        this.uniforms.set('u_ColorThin',  thin);
        this.uniforms.set('u_Extent',     extent);
        this.uniforms.set('u_Increment',  increment);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}

export default GridProgram;