import { Graph   } from './graph.js';
import { Frustum } from './frustum.js';

import { RevGL2 } from './revgl2.js';
import { RevGPU } from './revgpu.js';

import { EnvironmentNode } from './nodes/environment-node.js';
import { LightingNode    } from './nodes/lighting-node.js';
import { BaseNode        } from './nodes/base-node.js';
import { MainNode        } from './nodes/main-node.js';
import { PostNode        } from './nodes/post-node.js';
import { GridNode        } from './nodes/grid-node.js';
import { OutputNode      } from './nodes/output-node.js';

export class RenderPath {
    #initPromise;
    #width  = 0
    #height = 0;
    #observer;

    pre   = [];
    path  = [];
    post  = [];

    constructor(target, settings) {
        this.settings = settings;

        this.gal = new this.constructor.GAL();

        this.#initPromise = this.init(target);
    }

    async init(target) {
        await this.gal.init(target);

        if(this.settings?.autoResize) {
            this.observeCanvasResize();
        }

        this.resize({ width: this.gal.context.canvas.width, height: this.gal.context.canvas.height });
    }

    get initialized() {
        return this.#initPromise.then(() => this);
    }

    get width () {
        return this.#width;
    }

    get height () {
        return this.#height;
    }

    /**
     * Calculates the order of the nodes by working backwards from the output connections
     */
    calculateNodePath(output) {
        this.path.length = 0;

        const search = [output];
            
        while(search.length) {
            const node = search.pop();
            if(this.pre.indexOf(node) === -1) this.path.unshift(node);
            search.push(...Object.values(node.connections).map(({ src }) => src));
        }

        this.path = [...new Set(this.path)]; //Remove duplicates
    }

    connect(src, dst, connections) {
        for(const [output, input] of Object.entries(connections)) {
            dst.connections[input] = { src, output };
        }
    }

    disconnect(dst, connections) {
        if(dst.connections) {
            for(const name of connections) {
                delete dst.connections[name];
            }
        }
    }

    resize({ width, height }) {
        if(!width || !height) return;

        const { renderScale = 1 } = this.settings;

        width  = Math.floor(width * renderScale);
        height = Math.floor(height * renderScale);

        if(this.width !== width || this.height !== height) {
            this.#width  = width;
            this.#height = height;

            this.gal.resize({ width, height });
            for(const node of [...this.pre, ...this.path, ...this.post]) {
                node.resize({ width, height });
                node.reconfigure();
            }
            this.gal.context.canvas.dispatchEvent(new Event('resize'));
            return true;
        }
    }

    reconfigure() {
        const width  = this.gal.context.canvas.width * window.devicePixelRatio;
        const height = this.gal.context.canvas.height * window.devicePixelRatio;

        if(this.resize({ width, height })) return; // a resize will trigger a reconfigure of each node already         
        for(const node of [...this.pre, ...this.path, ...this.post]) {
            node.reconfigure();
        }
    }

    run({ graph, frusta }) {
        const commandEncoder = this.gal.device.createCommandEncoder();

        const instances = graph.upload(frusta);

        for(const node of this.pre) {
            node.run(commandEncoder, { graph, frusta });
        }

        for(let i = 0; i < frusta.length; i++) {
            const frustum = frusta[i];

            for(const node of this.path) {
                node.run(commandEncoder, { graph, frustum, instances: instances[i] });
            }

            for(const node of this.post) {
                node.run(commandEncoder, { graph, frustum });
            }
        }
        
        this.gal.device.queue.submit([commandEncoder.finish()]);
    }

    observeCanvasResize() {
        const { canvas } = this.gal.context;

        this.#observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.target != canvas) { continue; }
                const { inlineSize: width, blockSize: height } = entry.devicePixelContentBoxSize[0];
                
                if (Math.abs(width - canvas.width) > 1 || Math.abs(height - canvas.height) > 1) {
                    canvas.width  = width;
                    canvas.height = height;

                    this.resize({ width, height });
                }
            }
            
        });
        this.#observer.observe(canvas);
    }

    unobserveCanvasResize() {
        this.#observer?.unobserve(this.gal.context.canvas);
    }

    #graphs = new WeakMap();
    getSceneGraph(scene) {
        return this.#graphs.get(scene) || this.#graphs.set(scene, this.createSceneGraph(scene)).get(scene);
    }

    createSceneGraph(scene) {
        return new Graph(this.gal, scene);
    }

    createFrustum(options) {
        return new Frustum(this.gal, options);
    }
}

export class RevGPURenderPath extends RenderPath {
    static GAL = RevGPU;

    constructor(context, settings) {
        super(context, settings);

        const environment = new EnvironmentNode(this);
        const lighting    = new LightingNode(this);
        const base        = new BaseNode(this);
        const main        = new MainNode(this);
        const grid        = new GridNode(this);
        const post        = new PostNode(this, [grid]);
        const output      = new OutputNode(this);

        this.pre = [
            environment,
            lighting,
        ];

        this.connect(environment, base, { environment: 'environment', envGGX: 'envGGX', envCharlie: 'envCharlie', envLUT: 'envLUT', envSampler: 'envSampler' });
        this.connect(lighting,    base, { lighting: 'lighting' });

        this.connect(environment, main, { environment: 'environment', envGGX: 'envGGX', envCharlie: 'envCharlie', envLUT: 'envLUT', envSampler: 'envSampler' });
        this.connect(lighting,    main, { lighting: 'lighting' });

        this.connect(base, main,   { color: 'transmission' });
        this.connect(main, post,   { color: 'color', depth: 'depth' });
        this.connect(post, output, { color: 'color' });

        this.calculateNodePath(output);
    }
}

export class RevGL2RenderPath extends RevGPURenderPath {
    static GAL = RevGL2;
}

export default RenderPath;