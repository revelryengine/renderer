import { RenderPath } from '../render-path.js';

import { PreviewSettings   } from '../preview/preview-settings.js';

import { QueryNode } from './query-node.js';

export class QueryRenderPath extends RenderPath {
    static Settings = PreviewSettings;
    settings = new PreviewSettings(this.gal);

    reconfigureNodes() {
        const { nodes } = this;

        nodes.output ??= new QueryNode(this);
    }
}

RenderPath.define('query', QueryRenderPath);
