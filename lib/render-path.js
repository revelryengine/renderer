import { Graph   } from './graph.js';
import { Frustum } from './frustum.js';

import { RevGL2 } from './revgl2.js';
import { RevGPU } from './revgpu.js';

import { AudioController } from './audio.js';

import { AudioNode       } from './nodes/audio-node.js';
import { EnvironmentNode } from './nodes/environment-node.js';
import { PunctualNode    } from './nodes/punctual-node.js';
import { BaseNode        } from './nodes/base-node.js';
import { MainNode        } from './nodes/main-node.js';
import { PostNode        } from './nodes/post-node.js';
import { GridNode        } from './nodes/grid-node.js';
import { LensNode        } from './nodes/lens-node.js';
import { OutputNode      } from './nodes/output-node.js';
import { SSAONode        } from './nodes/ssao-node.js';
import { BloomNode       } from './nodes/bloom-node.js';

export class RenderPath {
    #initialized;

    #width  = 0
    #height = 0;
    #observer;

    pre   = [];
    path  = [];
    post  = [];

    constructor(target, settings) {
        this.gal = new this.constructor.GAL();

        this.#initialized = this.init(target, settings);
    }

    get settings() {
        return this.gal.settings;
    }

    async init(target, settings) {
        await this.gal.init(target, settings);

        if(this.settings?.autoResize) {
            this.observeCanvasResize();
        }

        this.resize({ width: this.gal.context.canvas.width, height: this.gal.context.canvas.height });

        this.audio = new AudioController();
    }

    destroy() {
        this.unobserveCanvasResize();
    }

    get initialized() {
        return this.#initialized.then(() => this);
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
        if(!dst) return;
        for(const [output, input] of Object.entries(connections)) {
            dst.connections[input] = { src, output };
        }
    }

    disconnect(dst, connections) {
        if(dst?.connections) {
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

        if(this.#width !== width || this.#height !== height) {
            this.#width  = width;
            this.#height = height;

            this.gal.resize({ width, height });
            // for(const node of [...this.pre, ...this.path, ...this.post]) {
            //     node.resize({ width, height });
            //     node.reconfigure();
            // }
            this.gal.context.canvas.dispatchEvent(new Event('resize'));
            this.reconfigure();
            return true;
        }
    }

    reconfigure() {
        // const width  = this.gal.context.canvas.width;
        // const height = this.gal.context.canvas.height;

        // if(this.resize({ width, height })) return; // a resize will trigger a reconfigure of each node already         
        for(const node of [...this.pre, ...this.path, ...this.post]) {
            node.reconfigure();
        }
    }

    run({ graph, frusta }) {
        const commandEncoder = this.gal.device.createCommandEncoder();

        graph.upload();

        const frustum   = frusta.length === 1 ? frusta[0] : frusta[0].union(frusta[1]);
        const instances = graph.generateInstances(frustum);

        for(const node of this.pre) {
            node.run(commandEncoder, { graph, frustum });
        }

        for(let i = 0; i < frusta.length; i++) {
            const frustum = frusta[i];

            frustum.upload();

            for(const node of this.path) {
                node.run(commandEncoder, { graph, frustum, instances });
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

        // const audio       = new AudioNode(this);
        // const environment = new EnvironmentNode(this);
        // const lighting    = new PunctualNode(this);
        // const base        = new BaseNode(this);
        // const ssao        = new SSAONode(this);
        // const main        = new MainNode(this);
        // const grid        = new GridNode(this);
        // const lens        = new LensNode(this);
        // const bloom       = new BloomNode(this);
        // const post        = new PostNode(this, [lens, grid, bloom]);
        // const output      = new OutputNode(this);

        // this.pre = [
        //     audio,
        //     environment,
        //     lighting,
        // ];

        // this.connect(environment, base, { environment: 'environment', envGGX: 'envGGX', envCharlie: 'envCharlie', envLUT: 'envLUT', envSampler: 'envSampler' });
        // this.connect(lighting,    base, { lighting: 'lighting', depth: 'shadows', shadowSampler: 'shadowSampler' });

        // this.connect(environment, main, { environment: 'environment', envGGX: 'envGGX', envCharlie: 'envCharlie', envLUT: 'envLUT', envSampler: 'envSampler' });
        // this.connect(lighting,    main, { lighting: 'lighting', depth: 'shadows', shadowSampler: 'shadowSampler' });

        // this.connect(base, ssao,   { point: 'point' });
        // this.connect(base, main,   { color: 'transmission' });
        // this.connect(ssao, main,   { color: 'ssao'  });

        // this.connect(main, post,   { color: 'color', depth: 'depth' });
        // this.connect(post, output, { color: 'color' });

        // this.calculateNodePath(output);
    }
    #nodes = {};
    reconfigure() {
        const nodes = this.#nodes;

        nodes.main   = nodes.main   || new MainNode(this);
        nodes.output = nodes.output || new OutputNode(this);

        if(this.settings.ssao.enabled) {
            nodes.ssao = nodes.ssao || new SSAONode(this);

            this.connect(nodes.ssao, nodes.main, { color: 'ssao' });
        } else {
            nodes.ssao = nodes.ssao?.destroy();

            this.disconnect(nodes.main, ['ssao']);
        }

        if(this.settings.transmission.enabled || this.settings.ssao.enabled) {
            nodes.base = nodes.base || new BaseNode(this);

            this.connect(nodes.base, nodes.main, { color: 'transmission' });
            this.connect(nodes.base, nodes.ssao, { point: 'point' });

        } else {
            nodes.base = nodes.base?.destroy();

            this.disconnect(nodes.main, ['transmission']);
            this.disconnect(nodes.ssao, ['point']);
        }

        this.pre = [];
        if(this.settings.audio.enabled) {
            this.pre.push(nodes.audio = nodes.audio || new AudioNode(this));
        } else {
            nodes.audio = nodes.audio?.destroy();
        }

        const envConnections = { environment: 'environment', envGGX: 'envGGX', envCharlie: 'envCharlie', envLUT: 'envLUT', envSampler: 'envSampler' };
        if(this.settings.environment.enabled) {
            this.pre.push(nodes.environment = nodes.environment || new EnvironmentNode(this));

            this.connect(nodes.environment, nodes.main, envConnections);
            this.connect(nodes.environment, nodes.base, envConnections);
        } else {
            nodes.environment = nodes.environment?.destroy();

            this.disconnect(nodes.main, Object.values(envConnections));
            this.disconnect(nodes.base, Object.values(envConnections));
        }

        const punConnections = { punctual: 'punctual', depth: 'shadows', shadowsSampler: 'shadowsSampler' };
        if(this.settings.punctual.enabled) {
            this.pre.push(nodes.punctual = nodes.punctual || new PunctualNode(this));

            this.connect(nodes.punctual, nodes.main, punConnections);
            this.connect(nodes.punctual, nodes.base, punConnections);
        } else {
            nodes.punctual = nodes.punctual?.destroy();

            this.disconnect(nodes.main, Object.values(punConnections));
            this.disconnect(nodes.base, Object.values(punConnections));
        }

        

        if(this.settings.lens.enabled) {
            nodes.lens = nodes.lens || new LensNode(this);
        }

        if(this.settings.grid.enabled) {
            nodes.grid = nodes.grid || new GridNode(this);
        }

        if(this.settings.bloom.enabled) {
            nodes.bloom = nodes.bloom || new BloomNode(this);
        }

        nodes.post = new PostNode(this, [nodes.lens, nodes.grid, nodes.bloom].filter(n => n));
        this.connect(nodes.main, nodes.post,   { color: 'color', depth: 'depth' });
        this.connect(nodes.post, nodes.output, { color: 'color' });

        this.calculateNodePath(nodes.output);

        super.reconfigure();
    }
}

export class RevGL2RenderPath extends RevGPURenderPath {
    static GAL = RevGL2;
}

export default RenderPath;