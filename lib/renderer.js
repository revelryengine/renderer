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
    /** @type {import('./revgpu.js').RevGPU|import('./revgl2.js').RevGL2} */
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
     * @return {Graph}
     */
    getSceneGraph(scene) {
        return this.#graphs.get(scene) ?? this.#graphs.set(scene, this.#createSceneGraph(scene)).get(scene);
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

            if (adapter.limits.maxColorAttachmentBytesPerSample < 64) {
                // If this is ever hit, we will need to manage the number of render attachements in the gltf nodes.
                // Using alphaMode weighted and SSAO at the same time causes the number of bytes to be over the default 32.
                console.warn('maxColorAttachmentBytesPerSample is less than 64.');
                console.warn('Alpha blend objects will not be rendered behind transmissive objects when using weighted transparency.');
            }
            const requiredLimits = {
                maxColorAttachmentBytesPerSample: Math.min(adapter.limits.maxColorAttachmentBytesPerSample, 64),
            }

            const optionalFeatures = /** @type {GPUFeatureName[]} */[
                'texture-compression-astc',
                'texture-compression-etc2',
                'texture-compression-bc',
            ];

            const requiredFeatures = /** @type {GPUFeatureName[]} */([]);
            for(const feature of optionalFeatures) {
                if(adapter.features.has(feature)) {
                    requiredFeatures.push(/** @type {GPUFeatureName} */(feature));
                }
            }

            const device = /** @type {GPUDevice|null} */(await Promise.race([
                adapter.requestDevice({ requiredFeatures, requiredLimits }),
                new Promise((resolve) => setTimeout(() => resolve(null), 1000)), //timeout after 1 second
            ]));

            if(!device) throw new Error('Failed to aquire GPU device');

            device.lost.then((info) => {
                if (info.reason !== 'destroyed') {
                    console.error(`device was unexpectedly lost: ${info.reason} ${info.message}`);
                    this.device = null;
                    this.requestDevice();
                }
                console.log('GPU Device destroyed');
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
     * @template {import('./viewport.js').ViewportTarget} [T=import('./viewport.js').ViewportTarget]
     * @template {Revelry.Renderer.RenderPathKeys} [K=any]
     * @param {{ target: T, renderPath: K } & Revelry.Renderer.RenderPathSettingsOptions<K>} options
     */
    createViewport({ target, renderPath, flags, values }) {
        const viewport = new Viewport(this.gal, { target, renderPath: new RenderPath.registry[renderPath](this.gal) });

        viewport.reconfigure({ flags, values });

        return viewport;
    }
}

export * from './graph.js'
export * from './frustum.js';
export * from './viewport.js';
export * from './constants.js';
