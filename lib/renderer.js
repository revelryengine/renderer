import { isCanvas, isRenderingContext } from './utils.js';

import { RevGL2                  } from './revgl2.js';
import { RevGPU                  } from './revgpu.js';
import { Graph, GameObjectFilter } from './graph.js';
import { Frustum                 } from './frustum.js';
import { CanvasAutoResizer       } from './utils.js';

import { RenderPath } from './render-paths/render-path.js';

import './render-paths/standard/standard-path.js';

/**
 * @typedef {Object} RendererOptions
 * @property {boolean} [forceWebGL2]
 * @property {boolean} [autoResize]
 * @property {Object} [renderPathSettings]
 * @property {HTMLCanvasElement|OffscreenCanvas|GPUCanvasContext|WebGL2RenderingContext} [target]
 */

export class Renderer {
    #mode;
    #width;
    #height;

    #autoResizer;
    #defaultViewport = new Frustum.DefaultViewport(this);

    /**
     * Creates an instance of Renderer.
     *
     * @param {RendererOptions} options
     */
    constructor({ forceWebGL2, autoResize, renderPathSettings = {}, target = document.createElement('canvas') }) {
        if(isRenderingContext(target)) {
            this.canvas = target.canvas;
        } else if(isCanvas(target)) {
            this.canvas = target;
        } else {
            throw new Error('Invalid target');
        }

        if(Renderer.supportedModes.webgpu && !forceWebGL2) {
            this.gal = new RevGPU(target, Renderer.device);
            this.#mode = 'webgpu';
        } else if(Renderer.supportedModes.webgl2) {
            this.gal = new RevGL2(target);
            this.#mode = 'webgl2'; 
        } else {
            throw new Error('No supported rendering modes.')
        }

        if(autoResize) {
            this.#autoResizer = new CanvasAutoResizer({ canvas: this.gal.context.canvas, onresize: () => this.reconfigure() });
        }

        this.reconfigure(renderPathSettings);
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

    renderPaths = {};
    reconfigure(renderPathSettings = {}) {
        const { canvas } = this.gal.context;

        const width  = Math.floor(canvas.width);
        const height = Math.floor(canvas.height);

        if(this.#width !== width || this.#height !== height) {
            this.#width  = width;
            this.#height = height;

            this.gal.reconfigure();
        }

        for(const [path, Constructor] of RenderPath.registry.entries()) {
            this.renderPaths[path] ??= new Constructor(this);
            this.renderPaths[path].reconfigure(renderPathSettings[path]);
        }
    }

    #run({ graph, frusta, renderPath, filter, options }) {
        renderPath = this.renderPaths[renderPath];

        const commandEncoder = this.gal.device.createCommandEncoder();

        const { settings  } = renderPath;
        const { sortAlpha } = settings;

        graph.run(settings);

        const frustum   = frusta.length === 1 ? frusta[0] : frusta[0].union(frusta[1]);
        const instances = graph.generateInstances({ frustum, sortAlpha, filter: new GameObjectFilter(filter) });

        for(const node of renderPath.prePath) {
            node.run(commandEncoder, { graph, frustum, settings, ...options });
        }

        for(let i = 0; i < frusta.length; i++) {
            const frustum = frusta[i];

            frustum.upload();

            for(const node of renderPath.path) {
                node.run(commandEncoder, { graph, frustum, instances, settings, ...options });
            }
        }
        
        this.gal.device.queue.submit([commandEncoder.finish()]);
    }

    /**
     * 
     * @param {{ graph: Graph, frustum: Frustum, filter?: Set }} param0 
     */
    render({ graph, frustum, renderPath = 'standard', filter, ...options }) {
        this.#run({ graph, frusta: [frustum], renderPath, filter, options });
    }

    #graphs = new WeakMap();
    getSceneGraph(scene) {
        return this.#graphs.get(scene) ?? this.#graphs.set(scene, this.#createSceneGraph(scene)).get(scene);
    }

    async getGameObjectIdAtPoint({ texture, graph, point }) {
        const x = point.x * texture.width;
        const y = point.y * texture.height;
        const index = new Uint32Array(await this.gal.readTexture({ texture, origin: { x, y }, size: { width: 1, height: 1 } }))[0];
        return graph.getGameObjectIdByIndex(index);
    }

    /** Assumes qeury path was run */
    async getRenderedGameObjects() {
        const { id: { texture }, query: { point, graph, occlusionQuerySet, gameObjects } } = this.renderPaths.query.output;
        if(point) {
            const gameObjectId = await this.getGameObjectIdAtPoint({ texture, graph, point });           
            return gameObjectId ? [gameObjectId] : [];
        } else {
            const results = await this.gal.resolveOcclusionQuerySet(occlusionQuerySet);
            return gameObjects.filter((_, index) => results[index]);
        }
    }

    #createSceneGraph(scene) {
        return new Graph(this.gal, scene);
    }

    createFrustum(viewport) {
        return new Frustum(this.gal, viewport ?? this.#defaultViewport);
    }

    renderXR(graph, frusta) {
        if(frusta.length !== 2) throw new Error('Unexpected number of frustra', frusta.length);
        this.#run({ graph, frusta });
    }

    async preloadTextures(textures) {
        return await Promise.all(textures.map(texture => this.gal.getTextureFromGLTF(texture).loaded));
    }

    clearShaderCache() {
        return this.gal.clearShaderCache();
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

            this.device.lost.then((info) => {
                if (info.reason !== "destroyed") {
                    console.error(`device was unexpectedly lost: ${info.message}`);
                    this.requestDevice();
                }
            });

            this.supportedModes.webgpu = !!this.device;

            return this.device;
        } catch(e) {
            console.warn(e);
            console.warn('WebGPU Not Supported');
        }
    }

    static get renderPathRegistry() {
        return RenderPath.registry;
    }

    async precompile(graph) {
        return Promise.all(Object.values(this.renderPaths).map(renderPath => renderPath.precompile(graph)));
    }
}

export default Renderer;