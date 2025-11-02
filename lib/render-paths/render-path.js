import { RenderPathSettings } from './render-path-settings.js';

/**
 * @typedef {import('./render-path.d.ts').RenderPath} RenderPathClass
 * @typedef {import('./render-node.js').RenderNode} RenderNode
 */

/**
 * @implements {RenderPathClass}
 */
export class RenderPath {
    nodes    = /** @type {Record<string, RenderNode>} */({});
    path     = /** @type {RenderNode[]} */([]);
    preNodes = /** @type {Record<string, RenderNode>} */({});
    prePath  = /** @type {RenderNode[]} */([]);

    width  = 0;
    height = 0;


    /**
     * @type {{ graph: import('../graph.js').Graph, frustum: import('../frustum.js').Frustum, instances: ReturnType<import('../graph.js').Graph['generateInstances']> }|null}
     */
    #passData = null;
    get passData() {
        return this.#passData;
    }

    /**
     * @param {import('../revgal.js').RevGAL} gal
     */
    constructor(gal) {
        /**
         * @readonly
         */
        this.gal = gal;

        this.settings = new RenderPathSettings(this.gal);
    }

    /**
     * @param {Parameters<RenderPathClass['reconfigure']>[0]} [flags]
     * @param {Parameters<RenderPathClass['reconfigure']>[1]} [values]
     */
    reconfigure(flags, values) {
        this.settings.reconfigure(flags, values);

        this.reconfigureNodePath();
        this.calculateNodePath();

        for(const node of [...this.prePath, ...this.path]) {
            node.reconfigure();
        }
    }

    reconfigureNodePath() {

    }

    /**
     * @type {RenderPathClass['connect']}
     */
    connect(src, dst, connections) {
        if(!src || !dst) return;
        for(const [output, input] of Object.entries(connections)) {
            if(input === undefined) continue;
            dst.connections[input] = src;
            Object.defineProperty(dst.input, input, { configurable: true, enumerable: true, get: () => src.output[output] });
        }
    }

    /**
     * @type {RenderPathClass['disconnect']}
     */
    disconnect(node, ...connections) {
        if(!node) return;
        for(const input of connections) {
            delete node.connections[input];
            delete node.input[input];
        }
    }

    /**
     * Calculates the order of the nodes by working backwards from the output connections
     */
    calculateNodePath() {
        this.path.length    = 0;
        this.prePath.length = 0;

        const search = [this.nodes.output];

        while (search.length) {
            const node = /** @type {RenderNode} */(search.pop());
            if(Object.values(this.preNodes).indexOf(node) === -1) {
                this.path.unshift(node);
            } else {
                this.prePath.unshift(node);
            }
            search.push(...Object.values(node.connections));
        }

        //Remove duplicates
        this.path    = [...new Set(this.path)];
        this.prePath = [...new Set(this.prePath)];
    }

    /**
     * @type {RenderPathClass['run']}
     */
    run({ graph, frustum, instances }) {
        this.#passData = { graph, frustum, instances };
        const commandEncoder = this.gal.device.createCommandEncoder();

        for(const node of this.prePath) {
            node.run(commandEncoder);
        }

        for(const node of this.path) {
            node.run(commandEncoder);
        }

        this.gal.device.queue.submit([commandEncoder.finish()]);
        this.#passData = null;
    }

    get output () {
        return this.nodes.output?.output;
    }

    /** @type {Record<string, typeof RenderPath>} */
    static registry = {};

    /**
     * @param {string} name
     * @param {typeof RenderPath} Constructor
     */
    static register(name, Constructor) {
        this.registry[name] = Constructor;
    }

    /**
     * @param {import('../graph.js').Graph} graph
     */
    async precompile(graph) {
        await Promise.all([...this.prePath, ...this.path].map(renderNode => renderNode.precompile(graph)));
    }

    destroy() {
        for(const node of [...this.prePath, ...this.path]) {
            node.destroy();
        }
    }
}
