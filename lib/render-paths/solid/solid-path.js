import { RenderPath } from '../render-path.js';
import { SolidSettings   } from './solid-settings.js';

import { PostNode    } from '../common/nodes/post-node.js';
import { OutputNode  } from '../common/nodes/output-node.js';
import { GridNode    } from '../common/nodes/grid-node.js';
import { TAANode     } from '../common/nodes/taa-node.js';
import { OutlineNode } from '../common/nodes/outline-node.js';

import { SolidNode } from './solid-node.js';


export class SolidRenderPath extends RenderPath {
    static Settings = SolidSettings;
    settings = new SolidSettings(this.gal);

    reconfigureNodes() {
        const { nodes } = this;

        nodes.solid  ??= new SolidNode(this);
        nodes.output ??= new OutputNode(this);

        nodes.post = new PostNode(this, this.reconfigurePostNodes().filter(n => n));
        this.connect(nodes.solid, nodes.post,  { color: 'color', depth: 'depth', motion: 'motion' });
        this.connect(nodes.post, nodes.output, { color: 'color' });
    }

    reconfigurePostNodes() {
        const { settings, nodes } = this;

        if(settings.flags.grid) {
            nodes.grid ??= new GridNode(this);
        } else {
            nodes.grid = nodes.grid?.destroy();
        }

        if(settings.flags.taa) {
            nodes.taa ??= new TAANode(this);
        } else {
            nodes.taa = nodes.taa?.destroy();
        }

        if(settings.flags.outline) {
            nodes.outline ??= new OutlineNode(this);
        } else {
            nodes.outline ??= nodes.outline?.destroy();
        }

        return [nodes.taa, nodes.grid, nodes.outline];
    }
}

RenderPath.define('solid', SolidRenderPath);
