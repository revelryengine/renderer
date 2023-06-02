import { Settings } from './settings.js';
import { isCanvas, isRenderingContext } from './utils.js';

import { RevGL2          } from './revgl2.js';
import { RevGPU          } from './revgpu.js';
import { Graph           } from './graph.js';
import { Frustum         } from './frustum.js';
import { AudioController } from './audio.js';

import { AudioNode         } from './nodes/audio-node.js';
import { EnvironmentNode   } from './nodes/environment-node.js';
import { PunctualNode      } from './nodes/punctual-node.js';
import { BaseNode          } from './nodes/base-node.js';
import { MainNode          } from './nodes/main-node.js';
import { PostNode          } from './nodes/post-node.js';
import { GridNode          } from './nodes/grid-node.js';
import { LensNode          } from './nodes/lens-node.js';
import { OutputNode        } from './nodes/output-node.js';
import { SSAONode          } from './nodes/ssao-node.js';
import { BloomNode         } from './nodes/bloom-node.js';
import { MotionBlurNode    } from './nodes/motion-blur-node.js';
import { TAANode           } from './nodes/taa-node.js';
import { CanvasAutoResizer } from './utils.js';

export class Renderer {
    #mode;
    #width;
    #height;

    #autoResizer;
    #defaultViewport = new Frustum.DefaultViewport(this);

    #pre   = [];
    #path  = [];
    #nodes = {};

    /**
     * Creates an instance of Renderer.
     *
     * @param {HTMLCanvasElement|OffscreenCanvas|GPUCanvasContext|WebGL2RenderingContext} target - Can either be an HTMLCanvasElement/OffscreenCanvas or
     * an existing GPUCanvasContext/WebGL2RenderingContext.
     */
    constructor(settings = {}, target = document.createElement('canvas')) {
        if(isRenderingContext(target)) {
            this.canvas = target.canvas;
        } else if(isCanvas(target)) {
            this.canvas = target;
        } else {
            throw new Error('Invalid target');
        }

        if(Renderer.supportedModes.webgpu && !settings.forceWebGL2) {
            this.gal = new RevGPU(target, settings, Renderer.device);
            this.#mode = 'webgpu';
        } else if(Renderer.supportedModes.webgl2) {
            this.gal = new RevGL2(target, settings);
            this.#mode = 'webgl2'; 
        } else {
            throw new Error('No supported rendering modes.')
        }

        if(this.settings.autoResize) {
            this.#autoResizer = new CanvasAutoResizer({ canvas: this.gal.context.canvas, onresize: () => this.reconfigure() });
        }

        this.audio = new AudioController();

        this.reconfigure();
    }

    destroy() {
        return this.#autoResizer?.destroy();
    }

    get mode() {
        return this.#mode;
    }

    get width() {
        return this.#width;
    }

    get height() {
        return this.#height;
    }

    /**
     * Calculates the order of the nodes by working backwards from the output connections
     */
    #calculateNodePath(output) {
        this.#path.length = 0;

        const search = [output];
            
        while(search.length) {
            const node = search.pop();
            if(this.#pre.indexOf(node) === -1) this.#path.unshift(node);
            search.push(...Object.values(node.connections).map(({ src }) => src));
        }

        this.#path = [...new Set(this.#path)]; //Remove duplicates
    }

    #connect(src, dst, connections) {
        if(!dst) return;
        for(const [output, input] of Object.entries(connections)) {
            dst.connections[input] = { src, output };
        }
    }

    #disconnect(dst, connections) {
        if(dst?.connections) {
            for(const name of connections) {
                delete dst.connections[name];
            }
        }
    }

    reconfigure() {
        const { canvas } = this.gal.context;

        const width  = Math.floor(canvas.width);
        const height = Math.floor(canvas.height);

        if(this.#width !== width || this.#height !== height) {
            this.#width  = width;
            this.#height = height;

            this.gal.reconfigure();
        }

        const nodes = this.#nodes;

        nodes.main   = nodes.main   || new MainNode(this);
        nodes.output = nodes.output || new OutputNode(this);

        if(this.settings.ssao.enabled) {
            nodes.ssao = nodes.ssao || new SSAONode(this);

            this.#connect(nodes.ssao, nodes.main, { color: 'ssao' });
        } else {
            nodes.ssao = nodes.ssao?.destroy();

            this.#disconnect(nodes.main, ['ssao']);
        }

        if(this.settings.transmission.enabled || this.settings.ssao.enabled) {
            nodes.base = nodes.base || new BaseNode(this);

            this.#connect(nodes.base, nodes.main, { color: 'transmission' });
            this.#connect(nodes.base, nodes.ssao, { point: 'point' });

        } else {
            nodes.base = nodes.base?.destroy();

            this.#disconnect(nodes.main, ['transmission']);
            this.#disconnect(nodes.ssao, ['point']);
        }

        this.#pre = [];
        if(this.settings.audio.enabled) {
            this.#pre.push(nodes.audio = nodes.audio || new AudioNode(this));
        } else {
            nodes.audio = nodes.audio?.destroy();
        }

        const envConnections = { environment: 'environment', envGGX: 'envGGX', envCharlie: 'envCharlie', envLUT: 'envLUT' };
        if(this.settings.environment.enabled) {
            this.#pre.push(nodes.environment = nodes.environment || new EnvironmentNode(this));

            this.#connect(nodes.environment, nodes.main, envConnections);
            this.#connect(nodes.environment, nodes.base, envConnections);
        } else {
            nodes.environment = nodes.environment?.destroy();

            this.#disconnect(nodes.main, Object.values(envConnections));
            this.#disconnect(nodes.base, Object.values(envConnections));
        }

        const punConnections = { punctual: 'punctual', depth: 'shadows', shadowsSampler: 'shadowsSampler' };
        if(this.settings.punctual.enabled) {
            this.#pre.push(nodes.punctual = nodes.punctual || new PunctualNode(this));

            this.#connect(nodes.punctual, nodes.main, punConnections);
            this.#connect(nodes.punctual, nodes.base, punConnections);
        } else {
            nodes.punctual = nodes.punctual?.destroy();

            this.#disconnect(nodes.main, Object.values(punConnections));
            this.#disconnect(nodes.base, Object.values(punConnections));
        }

        nodes.post = new PostNode(this, this.reconfigurePostNodes().filter(n => n));
        this.#connect(nodes.main, nodes.post,   { color: 'color', depth: 'depth', motion: 'motion' });
        this.#connect(nodes.post, nodes.output, { color: 'color' });

        this.#calculateNodePath(nodes.output);

        for(const node of [...this.#pre, ...this.#path]) {
            node.reconfigure();
        }
    }

    reconfigurePostNodes() {
        const nodes = this.#nodes;

        if(this.settings.lens.enabled) {
            nodes.lens = nodes.lens || new LensNode(this);
        } else {
            nodes.lens = nodes.lens?.destroy();
        }

        if(this.settings.grid.enabled) {
            nodes.grid = nodes.grid || new GridNode(this);
        } else {
            nodes.grid = nodes.grid?.destroy();
        }

        if(this.settings.bloom.enabled) {
            nodes.bloom = nodes.bloom || new BloomNode(this);
        } else {
            nodes.bloom = nodes.bloom?.destroy();
        }

        if(this.settings.motionBlur.enabled) {
            nodes.motionBlur = nodes.motionBlur || new MotionBlurNode(this);
        } else {
            nodes.motionBlur = nodes.motionBlur?.destroy();
        }

        if(this.settings.taa.enabled) {
            nodes.taa = nodes.taa || new TAANode(this);
        } else {
            nodes.taa = nodes.taa?.destroy();
        }

        return [nodes.taa, nodes.lens, nodes.grid, nodes.bloom, nodes.motionBlur];
    }


    #run({ graph, frusta }) {
        const commandEncoder = this.gal.device.createCommandEncoder();

        graph.run();

        const frustum   = frusta.length === 1 ? frusta[0] : frusta[0].union(frusta[1]);
        const instances = graph.generateInstances(frustum);

        for(const node of this.#pre) {
            node.run(commandEncoder, { graph, frustum });
        }

        for(let i = 0; i < frusta.length; i++) {
            const frustum = frusta[i];

            frustum.upload();

            for(const node of this.#path) {
                node.run(commandEncoder, { graph, frustum, instances });
            }
        }
        
        this.gal.device.queue.submit([commandEncoder.finish()]);
    }

    render(graph, frustum) {
        this.#run({ graph, frusta: [frustum] });
    }

    #graphs = new WeakMap();
    getSceneGraph(scene) {
        return this.#graphs.get(scene) || this.#graphs.set(scene, this.#createSceneGraph(scene)).get(scene);
    }

    #createSceneGraph(scene) {
        return new Graph(this.gal, scene);
    }

    createFrustum(viewport) {
        return new Frustum(this.gal, viewport ?? this.#defaultViewport);
    }

    renderXR(graph, frusta) {
        if(frustra.length !== 2) throw new Error('Unexpected number of frustra', frusta.length);
        this.#run({ graph, frusta });
    }

    async preloadTextures(textures) {
        return await Promise.all(textures.map(texture => this.gal.getTextureFromGLTF(texture).loaded));
    }

    clearShaderCache() {
        return this.gal.clearShaderCache();
    }

    static get defaultSettings (){
        return Settings.defaults;
    }

    get settings() {
        return this.gal.settings;
    }

    static supportedModes = {
        webgl2: !!self.WebGL2RenderingContext,
    }

    static async requestDevice() {
        try {
            const adapter = await navigator.gpu.requestAdapter();
            const optionalFeatures = [
                'texture-compression-astc',
                'texture-compression-etc2',
                'texture-compression-bc'
            ];
            const requiredFeatures = [];
            for(const feature of optionalFeatures) {
                if(adapter.features.has(feature)) {
                    requiredFeatures.push(feature);
                }
            }

            this.device = await Promise.race([
                adapter.requestDevice({ requiredFeatures }),
                new Promise((resolve) => setTimeout(() => resolve(null), 1000)), //timeout after 1 second
            ]);

            this.supportedModes.webgpu = !!this.device;

            return this.device;
        } catch(e) {
            console.warn(e);
            console.warn('WebGPU Not Supported');
        }
    }
}

export default Renderer;