import { RenderPath } from '../render-path.js';
import { Settings   } from './settings.js';

import { PostNode    } from '../common/nodes/post-node.js';
import { OutputNode  } from '../common/nodes/output-node.js';
import { GridNode    } from '../common/nodes/grid-node.js';
import { TAANode     } from '../common/nodes/taa-node.js';
import { OutlineNode } from '../common/nodes/outline-node.js';

import { PreviewNode } from './preview-node.js';

/**
 * @extends RenderPath<'preview'>
 */
export class PreviewRenderPath extends RenderPath {
    static Settings = Settings;
    settings = new Settings(this.gal);

    /**
     * @type {RenderPath<'preview'>['nodes']}
     */
    nodes = {};

    reconfigureNodes() {
        const { nodes } = this;

        nodes.preview ??= new PreviewNode(this);
        nodes.output  ??= new OutputNode(this);

        nodes.post = new PostNode(this, this.reconfigurePostNodes().filter(n => n));
        this.connect(nodes.preview, nodes.post, { color: 'color', depth: 'depth', motion: 'motion' });
        this.connect(nodes.post, nodes.output,  { color: 'color' });
    }

    reconfigurePostNodes() {
        const { settings, nodes } = this;

        if(settings.enabled.grid) {
            nodes.grid ??= new GridNode(this);
        } else {
            nodes.grid = nodes.grid?.destroy() ?? undefined;
        }

        if(settings.enabled.taa) {
            nodes.taa ??= new TAANode(this);
        } else {
            nodes.taa = nodes.taa?.destroy() ?? undefined;
        }

        if(settings.enabled.outline) {
            nodes.outline ??= new OutlineNode(this);
        } else {
            nodes.outline = nodes.outline?.destroy() ?? undefined;
        }

        return [nodes.taa, nodes.grid, nodes.outline];
    }
}

RenderPath.define('preview', PreviewRenderPath);
