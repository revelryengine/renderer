/// <reference path="./render-path.d.ts" />

import { UBO } from '../ubo.js';
import { RenderPathSettings } from './render-path-settings.js';

/**
 * @typedef {import('./render-path.d.ts').RenderPath} RenderPathClass
 * @typedef {import('./render-path.d.ts').RenderPathConstructor} RenderPathConstructor
 * @typedef {import('./render-node.js').RenderNode} RenderNode
 */

/**
 * @implements {RenderPathClass}
 */
export class RenderPath {
    static Settings = UBO;

    nodes    = /** @type {Record<String, RenderNode>} */({});
    path     = /** @type {RenderNode[]} */([]);
    preNodes = /** @type {Record<String, RenderNode>} */({});
    prePath  = /** @type {RenderNode[]} */([]);

    /**
     * @param {import('../viewport.js').Viewport} viewport
     */
    constructor(viewport) {
        this.viewport = viewport;
        this.settings = new RenderPathSettings(this.gal);
    }

    get gal() {
        return this.viewport.gal;
    }

    get target() {
        return this.viewport.target;
    }

    get width() {
        return this.viewport.width;
    }

    get height() {
        return this.viewport.height;
    }

    /**
     * @param {Parameters<RenderPathClass['reconfigure']>[0]} flags
     * @param {Parameters<RenderPathClass['settings']['values']['set']>[0]} values
     */
    reconfigure(flags, values) {
        if(flags) this.settings.reconfigure(flags);
        if(values) this.settings.values.set(values);

        this.reconfigureNodes();
        this.calculateNodePath();

        for(const node of [...this.prePath, ...this.path]) {
            node.reconfigure();
        }
    }

    reconfigureNodes() {

    }

    /**
     * @param {RenderNode} src
     * @param {RenderNode} dst
     * @param {Record<string, string>} connections
     */
    connect(src, dst, connections) {
        if(!dst) return;
        for(const [output, input] of Object.entries(connections)) {
            dst.connections[input] = { src, output };
        }
    }

    /**
     * @param {RenderNode} dst
     * @param {Record<string, string>} connections
     */
    disconnect(dst, connections) {
        if(dst?.connections) {
            for(const name of connections) {
                delete dst.connections[name];
            }
        }
    }

    /**
     * Calculates the order of the nodes by working backwards from the output connections
     */
    calculateNodePath() {
        this.path.length    = 0;
        this.prePath.length = 0;

        const search = [this.nodes.output];

        while(search.length) {
            const node = search.pop();
            if(Object.values(this.preNodes).indexOf(node) === -1) {
                this.path.unshift(node);
            } else {
                this.prePath.unshift(node);
            }
            search.push(...Object.values(node.connections).map(({ src }) => src));
        }

        //Remove duplicates
        this.path    = [...new Set(this.path)];
        this.prePath = [...new Set(this.prePath)];
    }

    get output () {
        return this.nodes.output?.output;
    }

    /** @type {Record<string, RenderPathConstructor>} */
    static registry = {};

    /**
     * @param {string} name
     * @param {RenderPathConstructor} Constructor
     */
    static define(name, Constructor) {
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
