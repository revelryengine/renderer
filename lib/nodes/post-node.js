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
        let color = this.getConnectionValue('color');
        let depth = this.getConnectionValue('depth');

        for(const child of this.children) {
            ({ color, depth } = child.reconfigure({ color, depth }));
        }

        this.output.color = color;
    }

    resize(...args) {
        for(const child of this.children) {
            child.resize(...args);
        }
    }

    run(commandEncoder, { graph, frustum }) {
        for(const child of this.children) {
            child.run(commandEncoder, { graph, frustum });
        }
    }
}

export default PostNode;