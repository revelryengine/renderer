import { RenderNode     } from './render-node.js';

/**
 * The Post Node is responsible for running all post process nodes. 
 */
export class PostNode extends RenderNode {
    constructor(renderPath, children) {
        super(renderPath);
        this.children = children;
    }
    reconfigure() {
        const color = this.getConnectionValue('color');
        const depth = this.getConnectionValue('depth');

        for(const child of this.children) {
            child.reconfigure({ color, depth });
        }

        this.output.color = color;
    }

    run(commandEncoder, { graph, frustum }) {
        for(const child of this.children) {
            child.run(commandEncoder, { graph, frustum });
        }
    }
}

export default PostNode;