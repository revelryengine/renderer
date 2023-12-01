import { RenderPath } from '../render-path.js';

import { Settings   } from '../preview/settings.js';

import { QueryNode } from './query-node.js';

export class QueryRenderPath extends RenderPath {
    static Settings = Settings;
    settings = new Settings(this.gal);

    reconfigureNodes() {
        const { nodes } = this;

        nodes.output ??= new QueryNode(this);
    }
}

RenderPath.define('query', QueryRenderPath);
