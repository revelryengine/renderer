import { RenderPath } from '../render-path.js';

import { Settings   } from './settings.js';

import { PostNode   } from '../common/nodes/post-node.js';
import { OutputNode } from '../common/nodes/output-node.js';
import { GridNode   } from '../common/nodes/grid-node.js';
import { TAANode    } from '../common/nodes/taa-node.js';

import { PreviewNode } from './nodes/preview-node.js';

export class PreviewRenderPath extends RenderPath {
    static Settings = Settings;

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

        if(settings.grid.enabled) {
            nodes.grid ??= new GridNode(this);
        } else {
            nodes.grid = nodes.grid?.destroy();
        }

        if(settings.taa.enabled) {
            nodes.taa ??= new TAANode(this);
        } else {
            nodes.taa = nodes.taa?.destroy();
        }

        return [nodes.taa, nodes.grid];
    }
}

RenderPath.define('preview', PreviewRenderPath);