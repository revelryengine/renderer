import { Program } from './program.js';

import { vertexShader   } from '../shaders/aabb.vert.js';
import { fragmentShader } from '../shaders/solid.frag.js';

export class AABBProgram extends Program {
    static vertexShaderSrc   = vertexShader;
    static fragmentShaderSrc = fragmentShader;
    static uniformBindings   = { Frustum: 0 };

    run({ input, frustum }){
        super.run();
        const { context: gl } = this;
        
        const { color = [1, 0, 1, 1] } = input;

        for(const { aabb } of frustum.iteratePrimitives()){
            this.uniforms.set('u_Color', color);
            this.uniforms.set('u_Min', aabb.min);
            this.uniforms.set('u_Max', aabb.max);

            gl.drawArrays(gl.LINES, 0, 24);
        }
    }
}

export default AABBProgram;