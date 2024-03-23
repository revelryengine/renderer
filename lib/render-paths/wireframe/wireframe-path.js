import { RenderPath } from '../render-path.js';
import { WireframeSettings   } from './wireframe-settings.js';

import { PostNode    } from '../common/nodes/post-node.js';
import { OutputNode  } from '../common/nodes/output-node.js';
import { GridNode    } from '../common/nodes/grid-node.js';
import { TAANode     } from '../common/nodes/taa-node.js';
import { OutlineNode } from '../common/nodes/outline-node.js';

import { WireframeNode } from './wireframe-node.js';

/**
 * @extends {RenderPath<{
*  nodes: {
    *      wireframe: WireframeNode,
    *      output:    OutputNode,
    *      post:      PostNode,
    *      grid?:     GridNode,
    *      taa?:      TAANode,
    *      outline?:  OutlineNode,
    *  }
    * }>}
    */
export class WireframeRenderPath extends RenderPath {
    static Settings = WireframeSettings;
    settings = new WireframeSettings(this.gal);

    reconfigureNodePath() {
        const { nodes } = this;

        nodes.wireframe ??= new WireframeNode(this);
        nodes.output    ??= new OutputNode(this);

        nodes.post = new PostNode(this, this.reconfigurePostNodePath());
        this.connect(nodes.wireframe, nodes.post, { color: 'color', depth: 'depth', motion: 'motion' });
        this.connect(nodes.post, nodes.output,    { color: 'color' });
    }

    reconfigurePostNodePath() {
        const { settings, nodes } = this;

        if(settings.flags.grid) {
            nodes.grid ??= new GridNode(this);
        } else {
            nodes.grid?.destroy();
            delete nodes.grid;
        }

        if(settings.flags.taa) {
            nodes.taa ??= new TAANode(this);
        } else {
            nodes.taa?.destroy();
            delete nodes.taa;
        }

        if(settings.flags.outline) {
            nodes.outline ??= new OutlineNode(this);
        } else {
            nodes.outline?.destroy();
            delete nodes.outline;
        }

        return [nodes.taa, nodes.grid, nodes.outline].filter(n => n != null);
    }
}

RenderPath.register('wireframe', WireframeRenderPath);
