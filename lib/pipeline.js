import { BaseNode        } from './nodes/base-node.js';
import { MainNode        } from './nodes/main-node.js';
import { GaussianNode    } from './nodes/gaussian-node.js';
import { LightingNode    } from './nodes/lighting-node.js';
import { SSAONode        } from './nodes/ssao-node.js';
import { DOFNode         } from './nodes/dof-node.js';
import { BloomNode       } from './nodes/bloom-node.js';
import { AABBNode        } from './nodes/aabb-node.js';
import { HighlightNode   } from './nodes/highlight-node.js';
import { EnvironmentUBO  } from './environment.js';
import { LightingUBO     } from './lighting.js';

const standardNodes = {
    BaseNode:        BaseNode,
    MainNode:        MainNode,
    GaussianNode:    GaussianNode,
    LightingNode:    LightingNode,
    SSAONode:        SSAONode,
    DOFNode:         DOFNode,
    BloomNode:       BloomNode,
    AABBNode:        AABBNode,
    HighlightNode:   HighlightNode,
}

export class Pipeline {
    #connections = new WeakMap();
    #output = null;
    #path = [];

    #width = 0;
    #height = 0;

    post = [];

    constructor(context, settings) {
        this.context  = context;
        this.settings = settings;

        this.environmentUBO = new EnvironmentUBO(this.context);
        this.lightingUBO    = new LightingUBO(this.context);
    }

    get width () {
        return this.#width;
    }

    get height () {
        return this.#height;
    }

    createNode(constructor, ...args) {
        if(typeof constructor === 'string'){
            return new standardNodes[constructor](this, ...args);
        }
        return new constructor(this, ...args);
    }

    /**
     * Recalculates the order of the nodes by working backwards from the output connections
     */
    recalculateNodePath() {
        this.#path.length = 0;

        if(this.#output) {

            let search = [this.#output];
            
            while(search.length) {
                const node = search.pop();
                this.#path.unshift(node);

                const connections = this.#connections.get(node);
                if(connections) {
                    search.push(...Object.values(connections).map(({ src }) => src));
                }
            }

            this.#path = [...new Set(this.#path)]; //Remove duplicates
        }
    }

    connect(src, dst, connections) {
        const dstConnections = this.#connections.get(dst) || this.#connections.set(dst, {}).get(dst);

        for(const [output, input] of Object.entries(connections)) {
            dstConnections[input] = { src, output };
        }

        this.recalculateNodePath();
    }

    output(node) {
        this.#output = node;
        this.recalculateNodePath();
    }

    disconnect(dst, connections) {
        const dstConnections = this.#connections.get(dst);
        if(dstConnections) {
            for(const name of connections) {
                delete dstConnections[name];
            }
        }
        this.recalculateNodePath();
    }

    resize({ width, height }) {
        if(this.#width !== width || this.#height !== height) {
            this.#width  = width;
            this.#height = height;

            for(const node of this.#path) {
                node.resize({ width, height });
            }

            for(const node of this.post) {
                node.resize({ width, height });
            }
        }
    }

    run({ graph, frustum, output }) {       
        const { context: gl } = this;

        const outputs = new Map();

        let lastOutput = null, lastNode;
        for(const node of this.#path) {
            let input = {};
            const connections = this.#connections.get(node);
            if(connections) {
                for(const name in connections) {
                    const { src, output } = connections[name];
                    input[name] = outputs.get(src)?.[output];
                }
            }
            const out = node.run({ graph, frustum, input });
            if(out) {
                lastOutput = out;
                lastNode   = node;
                outputs.set(node, out);
            }
        }

        if(this.settings.post.enabled) {
            for(const node of this.post) {
                let { color, depth } = lastOutput;
                const out = node.run({ graph, frustum, input: { color, depth } });
                if(out) {
                    lastOutput = out;
                    lastNode = node;
                }
            }
        }

        lastNode?.fbo.blitFramebuffer(output, gl.COLOR_BUFFER_BIT);

        /** Uncomment to debug shadow maps */
        // this.base.shadowNode.renderDebug(this);
    }

    reset() {
        if(!this.width) return; //No need to reset since it hasn't been used yet.

        for(const node of this.#path){
            node.reset();
        }
    }
}

export class StandardPipeline extends Pipeline {
    constructor(context, settings) {
        super(context, settings);

        this.lighting = this.createNode('LightingNode');
        this.base     = this.createNode('BaseNode');
        this.ssao     = this.createNode('SSAONode');
        this.main     = this.createNode('MainNode');

        this.connect(this.lighting, this.base, { shadows: 'shadows' });
        this.connect(this.lighting, this.main, { shadows: 'shadows' });
        
        this.connect(this.base, this.ssao, { point: 'point'        });
        this.connect(this.ssao, this.main, { ssao:  'ssao'         });
        this.connect(this.base, this.main, { color: 'transmission' });
        
        this.connect(this.main,  this.post, { color: 'color', depth: 'depth' });
        
        this.output(this.main);

        this.post = [
            this.createNode('DOFNode'),
            this.createNode('BloomNode'),
            this.createNode('HighlightNode'),
            this.createNode('AABBNode'),
        ];
    }
}

export default Pipeline;