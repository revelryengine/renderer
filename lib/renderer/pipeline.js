import { BaseNode     } from './nodes/base-node.js';
import { GLTFNode     } from './nodes/gltf-node.js';
import { GaussianNode } from './nodes/gaussian-node.js';
import { RenderNode   } from './nodes/render-node.js';
import { ShadowNode   } from './nodes/shadow-node.js';
import { SSAONode     } from './nodes/ssao-node.js';
import { DOFNode      } from './nodes/dof-node.js';
import { InputNode    } from './nodes/input-node.js';

const standardNodes = {
    BaseNode:     BaseNode,
    GLTFNode:     GLTFNode,
    GaussianNode: GaussianNode,
    ShadowNode:   ShadowNode,
    SSAONode:     SSAONode,
    DOFNode:      DOFNode,
    InputNode:    InputNode,
}

export class Pipeline {
    #connections = new WeakMap();
    #output = null;
    #path = [];

    #width = 0;
    #height = 0;

    constructor(context) {
        this.context = context;
    }

    get width () {
        return this.#width;
    }

    get height () {
        return this.#height;
    }

    createNode(constructor) {
        if(typeof constructor === 'string'){
            return new standardNodes[constructor](this);
        }
        return new constructor(this);
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
        }
    }

    run(graph, output) {
        this.resize(graph.viewInfo.viewport);
        
        const { context: gl } = this;

        const outputs = new Map();
        let outNode = null;

        for(const node of this.#path) {
            let input = {};
            const connections = this.#connections.get(node);
            if(connections) {
                for(const name in connections) {
                    const { src, output } = connections[name];
                    input[name] = outputs.get(src)[output];
                }
            }
            const out = node.render(graph, input);
            if(!out.skipped) outNode = node;
            outputs.set(node, out);
        }

        RenderNode.blitFramebuffer(gl, outNode, output, gl.COLOR_BUFFER_BIT);

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
    constructor(context) {
        super(context);

        this.shadow = this.createNode('ShadowNode');
        this.base   = this.createNode('BaseNode');
        this.ssao   = this.createNode('SSAONode');
        this.gltf   = this.createNode('GLTFNode');
        this.dof    = this.createNode('DOFNode');
        this.input  = this.createNode('InputNode');

        this.connect(this.input, this.base, { ids: 'ids' });

        this.connect(this.shadow, this.base, { shadows: 'shadows' });
        this.connect(this.shadow, this.gltf, { shadows: 'shadows' });
        
        this.connect(this.base, this.ssao, { normal: 'normal', depth: 'depth' });
        this.connect(this.base, this.gltf, { color: 'transmission' });
        this.connect(this.ssao, this.gltf, { ssao: 'ssao' });

        this.connect(this.gltf,  this.dof, { color: 'color', depth: 'depth'  });
        
        this.output(this.dof);
    }
}

export default Pipeline;