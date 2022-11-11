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
        let color  = this.getConnectionValue('color');
        let depth  = this.getConnectionValue('depth');
        let motion = this.getConnectionValue('motion');

        for(const child of this.children) {
            ({ color = color, depth = depth, motion = motion } = child.reconfigure({ color, depth, motion }) || {});
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