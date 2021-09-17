import { BaseProgram  } from '../programs/gltf/base-program.js';
import { FBO          } from '../fbo.js';
import { GeometryNode } from './render-node.js';

const GL = WebGL2RenderingContext;
/**
 * The Base Node is responsible for capturing the linear output of all opaque objects along with depth and normals. 
 */
export class BaseNode extends GeometryNode {
    opaque = true;

    program = BaseProgram;

    lighting = true;

    scaleFactor = 0.5;

    fbo = new FBO(this.pipeline.context, {
        colors: [
            { name: 'color' },
            { name: 'point', params: { min: GL.NEAREST, mag: GL.NEAREST, format: GL.RGBA, internalFormat: GL.RGBA32F , type: GL.FLOAT } },
            { name: 'ids',   params: { min: GL.NEAREST, mag: GL.NEAREST, format: GL.RG_INTEGER, internalFormat: GL.RG32UI , type: GL.UNSIGNED_INT } },
        ],
        depth: { name: 'depth' },
    })

    output = {
        color:    { type: 'texture' },
        point:    { type: 'texture' },
        ids:      { type: 'texture' },
        depth:    { type: 'texture' },
    }

    clear() {
        /** @todo handle this automatically in the RenderNode */
        const { context: gl } = this.pipeline;
        const { framebuffer } = this.fbo;

        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.viewport(0, 0, this.width, this.height);
        
        gl.clearBufferfv(gl.COLOR,  0, [0,0,0,0]);
        gl.clearBufferfv(gl.COLOR,  1, [0,0,0,0]);
        gl.clearBufferuiv(gl.COLOR, 2, [0,0,0,0]);
        gl.clear(gl.DEPTH_BUFFER_BIT); 
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
    }
}

export default BaseNode;