import { RenderPath } from '../render-path.js';

import { QuerySettings } from './query-settings.js';

import { QueryNode  } from './query-node.js';

import { NonNull } from '../../../deps/utils.js';

/**
 * @extends {RenderPath<{
 *  nodes: {
 *     output: QueryNode
 *  ,}
 * }>}
 */
export class QueryRenderPath extends RenderPath {
    settings = new QuerySettings(this.gal);

    reconfigureNodePath() {
        const { nodes } = this;

        nodes.output ??= new QueryNode(this);
    }

    /**
     * @type {Promise<string[]>}
     */
    results = Promise.resolve([]);

    /**
     * @type {RenderPath['run']}
     */
    run({ graph, frustum, instances }) {
        super.run({ graph, frustum, instances });

        this.results = this.getRenderedGameObjects(graph);
    }

    /**
     * @param {import('../../graph.js').Graph} graph
     */
    async getRenderedGameObjects(graph) {
        const { id, query } = this.nodes.output.output;

        if(query.mode === 'point') {
            const gameObjectId = await this.getGameObjectIdAtPoint(graph, { texture: NonNull(id.texture), point: query.point });
            return gameObjectId ? [gameObjectId] : [];
        } else {
            const results = await this.gal.resolveOcclusionQuerySet(query.occlusionQuerySet);
            return query.gameObjects.filter((_, index) => results[index]);
        }
    }

    /**
     * @param {import('../../graph.js').Graph} graph
     * @param {{ texture: import('../../revgal.js').REVTexture, point: vec2 }} options
     */
    async getGameObjectIdAtPoint(graph, { texture, point }) {
        const x = point[0] * texture.width;
        const y = point[1] * texture.height;
        const index = new Uint32Array(await this.gal.readTexture(texture, { origin: { x, y }, size: { width: 1, height: 1 } }))[0];
        return graph.getGameObjectIdByIndex(index);
    }
}

RenderPath.register('query', QueryRenderPath);
