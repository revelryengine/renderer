import { RevGPURenderPath, RevGL2RenderPath } from './render-path.js';

export class Renderer {
    #mode;
    #initPromise;

    /**
     * Creates an instance of Renderer.
     *
     * @param {string|HTMLCanvasElement|GPUCanvasContext|WebGL2RenderingContext} target - Can either be an HTMLCanvasElement, a selector, or
     * an existing GPUCanvasContext/WebGL2RenderingContext.
     */
    constructor(target, settings = {}) {
        this.settings = settings;
        
        if(typeof target === 'string'){
            target = document.querySelector(target);
            if(!(target instanceof HTMLCanvasElement)) throw new Error('Invalid target: selector did not match HTMLCanvasElement');
        }

        if(settings.forceWebGL2) {
            this.#initPromise = this.#initWebGL2(target, settings);
        } else {
            this.#initPromise = this.#initWebGPU(target, settings);
        }
    }


    async #initWebGPU(target, settings) {
        try {
            this.renderPath = await new RevGPURenderPath(target, settings).initialized;
            this.#mode      = 'webgpu';
        } catch (e) {
            console.warn(e);
            console.warn('Failed to initialize WebGPU. Falling back to WebGL2');            
            await this.#initWebGL2(target, settings);
        }
    }

    async #initWebGL2(target, settings) {
        try {
            this.renderPath = await new RevGL2RenderPath(target, settings).initialized;
            this.#mode      = 'webgl2';
        } catch (e) {
            console.warn(e);
            throw new Error('Failed to initialize WebGL2.');
        }
    }

    get initialized() {
        return this.#initPromise.then(() => this);
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
        return this.renderPath?.destroy?.();
    }

    reconfigure() {
        return this.renderPath?.reconfigure();
    }

    async preloadTextures(textures) {
        return await Promise.all(textures.map(texture => this.renderPath.gal.getTextureFromGLTF(texture).loaded));
    }

    clearShaderCache() {
        return this.renderPath?.gal.clearShaderCache();
    }

    static defaultSettings = {
        environment : { enabled: true },
        punctual    : { enabled: true },
    }
}

export default Renderer;