import { RevGL2   } from './revgl2.js';
import { RevGPU   } from './revgpu.js';
import { Graph    } from './graph.js';
import { Viewport } from './viewport.js';

import { RenderPath } from './render-paths/render-path.js';

import './render-paths/standard/standard-path.js';
import './render-paths/preview/preview-path.js';
import './render-paths/solid/solid-path.js';
import './render-paths/wireframe/wireframe-path.js';
import './render-paths/query/query-path.js';

export class Renderer {
    /** @type {import('./revgal.js').RevGAL} */
    gal;

    #mode;

    /**
     * @type {HTMLCanvasElement | OffscreenCanvas}
     */
    canvas;

    /**
     * Creates an instance of Renderer.
     *
     * @param {{ forceWebGL2?: boolean}} [options]
     */
    constructor({ forceWebGL2 } = {}) {
        this.canvas = new OffscreenCanvas(2, 2);

        if(Renderer.supportedModes.webgpu && !forceWebGL2 && Renderer.device) {
            this.gal = new RevGPU(this.canvas, Renderer.device);
            this.#mode = 'webgpu';
        } else if(Renderer.supportedModes.webgl2) {
            this.gal = new RevGL2(this.canvas);
            this.#mode = 'webgl2';
        } else {
            throw new Error('No supported rendering modes.')
        }
    }

    destroy() {
        this.gal?.destroy();
    }

    get mode() {
        return this.#mode;
    }

    #graphs = new WeakMap();
    /**
     * @param {import('../deps/gltf.js').Scene} scene
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
     * @param {import('../deps/gltf.js').Scene} scene
     */
    #createSceneGraph(scene) {
        return new Graph(this.gal, scene);
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
     * @template {Revelry.Renderer.RenderPathKeys} [K='standard']
     * @template {import('./viewport.js').ViewportTarget} [T=import('./viewport.js').ViewportTarget]
     * @param {{ target: T } & Revelry.Renderer.RenderPathSettingsOptions<K>} options
     */
    createViewport({ target, renderPath, flags, values }) {
        return new Viewport(this.gal, { target, renderPath: renderPath ?? 'standard', flags, values });
    }
}

export * from './graph.js'
export * from './frustum.js';
export * from './viewport.js';
