import { RenderNode  } from './render-node.js';
import { ShadowNode  } from './shadow-node.js';
import { BaseProgram } from '../programs/base-program.js';

/**
 * The Base Node is responsible for capturing the linear output of all opaque objects along with depth and normals. 
 * It will also delegate rendering of shadow maps for all spot/directional lights in the scene.
 */
export class BaseNode extends RenderNode {
    static type = 'geometry';
    static opaque = true;

    static program = BaseProgram;

    static scaleFactor = 0.5;

    shadowNode = new ShadowNode(this.pipeline);

    static output = {
        color:  { type: 'texture', attachmentType: 'color' },
        normal: { type: 'texture', attachmentType: 'color' },
        depth:  { type: 'texture', attachmentType: 'depth' },
    }

    resize({ width, height }){
        super.resize({ width, height });        
        this.shadowNode.resize({ width: this.width, height: this.height });
    }

    render(graph) {
        this.shadowNode.render(graph);
        graph.shadows = this.shadowNode.output.shadows;
        return super.render(...arguments);
    }
}

export default BaseNode;