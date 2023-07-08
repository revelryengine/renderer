/**
 * @todo split and cache vertext/fragment compilation
 */

 export class Shader {
    #error;
    #compilePromise;

    static wgsl = null;
    static glsl = null;

    constructor(gal, input) {
        this.gal        = gal;
        this.input      = input;
    }

    #init() {
        this.flags      = this.getFlags();
        this.uniforms   = this.getUniforms();
        this.locations  = this.getLocations();
        this.hints      = this.getHints();
        this.cacheKey   = this.getCacheKey();

        const { vertShader, fragShader } = this.gal.generateShaders(this.constructor, this);

        this.vertShader = vertShader;
        this.fragShader = fragShader;

        this.renderPipelineDescriptor = this.getRenderPipelineDescriptor();
    }

    compile() {
        this.#init();

        try {
            this.renderPipeline = this.gal.createPipelineFromCache({ cacheKey: this.cacheKey, descriptor: this.renderPipelineDescriptor })
        } catch(e) {
            console.warn(e);
            this.#error = e;
            this.outputCompilationErrors();
        }

        return this;
    }

    compileAsync() {
        this.#init();

        this.#compilePromise = this.gal.createPipelineFromCacheAsync({ cacheKey: this.cacheKey, descriptor: this.renderPipelineDescriptor }).then(renderPipeline => {
            this.renderPipeline = renderPipeline;
        }).catch(async (e) => {
            console.warn(e);
            this.#error = e;
            this.outputCompilationErrors();
        });

        return this;
    }

    async outputCompilationErrors() {
        for(const module of [this.vertShader, this.fragShader]) {
            const info = await module.getCompilationInfo();
            for(const msg of info.messages) {
                if(msg.type === 'error') {
                    console.warn('Shader compilation error', `${msg.lineNum}:${msg.linePos} - ${msg.message}`);
                    if(msg.src) console.warn(msg.src.split(`\n`).map((line, i) => `${i + 1}: ${line}`).join('\n'));
                    return;
                }
            }
        }
    }

    get error() {
        return this.#error;
    }

    get ready() {
        return !!this.renderPipeline;
    }

    get compiled() {
        return this.#compilePromise;
    }

    run() {

    }

    getCacheKey() {
        return `${this.constructor.name}:${JSON.stringify(this.flags)}:${JSON.stringify(this.locations)}`;
    }

    getFlags() {
        return {};
    }

    getUniforms() {
        return {};
    }

    getLocations() {
        return {};
    }

    getHints() {

    }    
}

export default Shader;