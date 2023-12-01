import { RevGAL                  } from './revgal.js';
import { RevGL2                  } from './revgl2.js';
import { RevGPU                  } from './revgpu.js';
import { Graph, GameObjectFilter } from './graph.js';
import { Frustum                 } from './frustum.js';
import { CanvasAutoResizer       } from '../deps/utils.js';

import { RenderPath } from './render-paths/render-path.js';

import './render-paths/standard/standard-path.js';

/**
 * @typedef {import('../deps/gltf.js').Scene} Scene
 * @typedef {import('./frustum.js').Viewport} Viewport
 */

/**
 * @typedef {Object} RendererOptions
 * @property {boolean} [forceWebGL2]
 * @property {boolean} [autoResize]
 * @property {Object} [renderPathSettings]
 * @property {HTMLCanvasElement|OffscreenCanvas|GPUCanvasContext|WebGL2RenderingContext} [target]
 */

export class Renderer {
    /** @type {import('./revgal.js').RevGAL} */
    gal;

    #mode;

    #width = 0;
    #height = 0;

    #autoResizer;
    #defaultViewport = new Frustum.DefaultViewport(this);

    /**
     * @type {HTMLCanvasElement | OffscreenCanvas}
     */
    canvas;

    /**
     * Creates an instance of Renderer.
     *
     * @param {RendererOptions} options
     */
    constructor({ forceWebGL2, autoResize, renderPathSettings = {}, target = document.createElement('canvas') }) {
        if(RevGAL.isRenderingContext(target)) {
            this.canvas = target.canvas;
        } else if(RevGAL.isCanvas(target)) {
            this.canvas = target;
        } else {
            throw new Error('Invalid target');
        }

        if(Renderer.supportedModes.webgpu && !forceWebGL2 && !RevGAL.isGL2Context(target) && Renderer.device) {
            this.gal = new RevGPU(target, Renderer.device);
            this.#mode = 'webgpu';
        } else if(Renderer.supportedModes.webgl2 && !RevGAL.isGPUContext(target)) {
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
        return this.#autoResizer?.stop();
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

    renderPaths = /** @type {{ [K in keyof Revelry.Renderer.RenderPaths]: RenderPath<K>}}*/({});

    /**
     * @param {any} renderPathSettings
     */
    reconfigure(renderPathSettings = {}) {
        const { canvas } = this.gal.context;

        const width  = Math.floor(canvas.width);
        const height = Math.floor(canvas.height);

        if(this.#width !== width || this.#height !== height) {
            this.#width  = width;
            this.#height = height;

            this.gal.reconfigure();
        }

        for(const entry of Object.entries(RenderPath.registry)) {
            const [path, Constructor] = /** @type {[keyof Revelry.Renderer.RenderPaths, import('./render-paths/render-path.js').RenderPathConstructor<any>]} */(entry);
            this.renderPaths[path] ??= new Constructor(this);
            this.renderPaths[path].reconfigure(renderPathSettings[path]);
        }
    }
    /**
     * @param {{ graph: Graph, frusta: Frustum[], renderPath?: keyof Revelry.Renderer.RenderPaths, filter?: ConstructorParameters<typeof GameObjectFilter>[0], options?: any }} options
     */
    #run({ graph, frusta, renderPath, filter, options }) {
        const commandEncoder = this.gal.device.createCommandEncoder();

        const { settings, path, prePath  } = this.renderPaths[renderPath ?? 'standard'];

        const sortAlpha = !!(settings && 'sortAlpha' in settings && settings.sortAlpha);

        graph.run(settings);

        const frustum   = frusta.length === 1 ? frusta[0] : frusta[0].union(frusta[1]);
        const instances = graph.generateInstances({ frustum, sortAlpha, filter: new GameObjectFilter(filter) });

        for(const node of prePath) {
            node.run(commandEncoder, { graph, frustum, settings, ...options });
        }

        for(let i = 0; i < frusta.length; i++) {
            const frustum = frusta[i];

            frustum.upload();

            for(const node of path) {
                node.run(commandEncoder, { graph, frustum, instances, settings, ...options });
            }
        }

        this.gal.device.queue.submit([commandEncoder.finish()]);
    }

    /**
     * @template {keyof Revelry.Renderer.RenderPaths} T
     * @param {(
     *  { graph: Graph, frustum: Frustum, renderPath?: T, filter?: ConstructorParameters<typeof GameObjectFilter>[0] } & Revelry.Renderer.RenderPaths[T]['options']
     * )} options
     */
    render({ graph, frustum, renderPath, filter, ...options }) {
        this.#run({ graph, frusta: [frustum], renderPath, filter, options });
    }

    #graphs = new WeakMap();
    /**
     * @param {Scene} scene
     */
    getSceneGraph(scene) {
        return this.#graphs.get(scene) ?? this.#graphs.set(scene, this.#createSceneGraph(scene)).get(scene);
    }

    /**
     * @param {{ texture: import('./revgal.js').REVTexture, graph: Graph, point: { x: number, y: number }}} options
     */
    async getGameObjectIdAtPoint({ texture, graph, point }) {
        const x = point.x * texture.width;
        const y = point.y * texture.height;
        const index = new Uint32Array(await this.gal.readTexture(texture, { origin: { x, y }, size: { width: 1, height: 1 } }))[0];
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
    /**
     * @param {Scene} scene
     */
    #createSceneGraph(scene) {
        return new Graph(this.gal, scene);
    }

    /**
     * @param {Viewport} viewport
     */
    createFrustum(viewport) {
        return new Frustum(this.gal, viewport ?? this.#defaultViewport);
    }

    /**
     * @param {Graph} graph
     * @param {Frustum[]} frusta
     */
    renderXR(graph, frusta) {
        if(frusta.length !== 2) throw new Error(`Unexpected number of frustra (${frusta.length})`);
        this.#run({ graph, frusta });
    }

    /**
     * @param {import('../deps/gltf.js').Texture[]} textures
     */
    async preloadTextures(textures) {
        return await Promise.all(textures.map(texture => this.gal.getTextureFromGLTF(texture).loaded));
    }

    clearShaderCache() {
        return this.gal.clearShaderCache();
    }

    static supportedModes = {
        webgl2: !!self.WebGL2RenderingContext,
        webgpu: false,
    }

    static async requestDevice() {
        try {
            const adapter = await navigator.gpu.requestAdapter();

            if(!adapter) throw new Error('Failed to aquire GPU adapter');

            const optionalFeatures = /** @type {GPUFeatureName[]} */[
                'texture-compression-astc',
                'texture-compression-etc2',
                'texture-compression-bc'
            ];

            const requiredFeatures = /** @type {GPUFeatureName[]} */([]);
            for(const feature of optionalFeatures) {
                if(adapter.features.has(feature)) {
                    requiredFeatures.push(/** @type {GPUFeatureName} */(feature));
                }
            }

            const device = /** @type {GPUDevice|null} */(await Promise.race([
                adapter.requestDevice({ requiredFeatures }),
                new Promise((resolve) => setTimeout(() => resolve(null), 1000)), //timeout after 1 second
            ]));

            if(!device) throw new Error('Failed to aquire GPU device');

            device.lost.then((info) => {
                if (info.reason !== "destroyed") {
                    console.error(`device was unexpectedly lost: ${info.message}`);
                    this.requestDevice();
                }
            });

            this.device = device;

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

    /**
     * @param {Graph} graph
     */
    async precompile(graph) {
        return Promise.all(Object.values(this.renderPaths).map(renderPath => renderPath.precompile(graph)));
    }
}
