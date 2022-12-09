import { RevGPURenderPath, RevGL2RenderPath } from './render-path.js';
import { Settings } from './settings.js';

export class Renderer {
    #mode;

    /**
     * Creates an instance of Renderer.
     *
     * @param {HTMLCanvasElement|GPUCanvasContext|WebGL2RenderingContext} target - Can either be an HTMLCanvasElement, or
     * an existing GPUCanvasContext/WebGL2RenderingContext.
     */
    constructor(settings = {}, target = document.createElement('canvas')) {
        if(this.#isRenderingContext(target)) {
            this.canvas = target.canvas;
        } else if(target instanceof HTMLCanvasElement) {
            this.canvas = target;
        } else {
            throw new Error('Invalid target');
        }

        if(Renderer.supportedModes.webgpu && !settings.forceWebGL2) {
            this.renderPath = new RevGPURenderPath(target, settings, Renderer.device); 
            this.#mode = 'webgpu';
        } else if(Renderer.supportedModes.webgl2) {
            this.renderPath = new RevGL2RenderPath(target, settings);
            this.#mode = 'webgl2'; 
        } else {
            throw new Error('No supported rendering modes.')
        }

        this.renderPath.reconfigure();
    }

    #isRenderingContext(target) {
        //GPUCanvasContext may not be defined if browser does not support WebGPU
        return (globalThis.GPUCanvasContext && target instanceof globalThis.GPUCanvasContext) || target instanceof WebGL2RenderingContext;
    }

    get mode() {
        return this.#mode;
    }

    get width() {
        return this.renderPath.width;
    }

    get height() {
        return this.renderPath.height;
    }
    
    render(graph, frustum) {
        this.renderPath.run({ graph, frusta: [frustum] });
    }

    renderXR(graph, frusta) {
        if(frustra.length !== 2) throw new Error('Unexpected number of frustra', frusta.length);
        this.renderPath.run({ graph, frusta });
    }

    getSceneGraph(scene) {
        return this.renderPath.getSceneGraph(scene);
    }

    createFrustum(options) {
        return this.renderPath.createFrustum(options);
    }

    destroy() {
        return this.renderPath?.destroy();
    }

    reconfigure() {
        return this.renderPath?.reconfigure();
    }

    async preloadTextures(textures) {
        return await Promise.all(textures.map(texture => this.renderPath.gal.getTextureFromGLTF(texture).loaded));
    }

    clearShaderCache() {
        return this.renderPath.gal.clearShaderCache();
    }

    static get defaultSettings (){
        return Settings.defaults;
    }

    get settings() {
        return this.renderPath.settings;
    }

    static supportedModes = {
        webgl2: !!document.createElement('canvas').getContext('webgl2'),
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

            this.device = await adapter.requestDevice({ requiredFeatures });
            this.supportedModes.webgpu = true;

            return this.device;
        } catch(e) {
            console.warn(e);
            console.warn('WebGPU Not Supported');
        }
    }
}

export default Renderer;