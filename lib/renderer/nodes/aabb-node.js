import { RenderNode    } from './render-node.js';
import { Program       } from '../programs/program.js';
import { OutputProgram } from '../programs/output-program.js';
import { MSFBO         } from '../fbo.js';

import processUtils from '../shaders/process-utils.glsl.js';
import fragmentShader from '../shaders/solid.frag.js';

const glsl = String.raw; // For syntax-highlighting
class AABBProgram extends Program {
    static vertexShaderSrc = glsl`
        precision highp float;

        ${processUtils}

        uniform vec3 u_Min;
        uniform vec3 u_Max;

        const vec3 cube[8] = vec3[](
            // front face
            vec3(-1,-1, 1),
            vec3(-1, 1, 1),
            vec3( 1, 1, 1),
            vec3( 1,-1, 1),
            

            // back face
            vec3(-1,-1,-1),
            vec3(-1, 1,-1),
            vec3( 1, 1,-1),
            vec3( 1,-1,-1)
        );

        const int indices[24] = int[](
            0, 1,   1, 2,   2, 3,   3, 0, // front
            4, 5,   5, 6,   6, 7,   7, 4, // back
            0, 4,   1, 5,   2, 6,   3, 7  // sides
        );

        void main(void) {
            vec3 center  = (u_Min + u_Max) * 0.5; 
            vec3 extents = (u_Min - u_Max) * 0.5;

            vec3 pos = (center + (cube[indices[gl_VertexID]] * extents));

            gl_Position = u_Frustum.viewProjectionMatrix * vec4(pos, 1.0);
        }
    `;
    static fragmentShaderSrc = fragmentShader;

    run({ input, frustum }){
        super.run();
        const { context: gl } = this;
        
        const { color = [1, 0, 1, 1] } = input;

        for(const { aabb } of frustum.iteratePrimitives()){
            this.uniforms.set('u_Color', color);
            this.uniforms.set('u_Min', aabb.min);
            this.uniforms.set('u_Max', aabb.max);
            this.uniforms.set('u_Frustum', frustum);
            this.uniforms.update();

            gl.drawArrays(gl.LINES, 0, 24);
        }
    }
}

/**
 * The AABB Node is responsible for rendering axis aligned bounding boxes for all primitives. 
 * This is useful for debugging purposes.
 */
export class AABBNode extends RenderNode {
    program = AABBProgram;

    scaleFactor = 1;
    
    fbo = new MSFBO(this.pipeline.context, {
        colors: [
            { name: 'color' },
        ],
        depth: { name: 'depth' },
    })

    output = {
        color:  { type: 'texture' },
    }

    #outputProgram = new OutputProgram(this.pipeline.context);

    run({ graph, input, frustum }) {
        if(!this.pipeline.settings.aabb.enabled) return;
        return super.run({ graph, input, frustum });
    }
    render({ graph, input, frustum }) {
        this.#outputProgram.run({ graph, frustum, input });
        super.render({ graph, frustum });
    }
}

export default AABBNode;