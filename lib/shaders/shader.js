/**
 * @todo split and cache vertext/fragment compilation
 */

 export class Shader {
    #error;
    #ready;
    #initPromise;

    static wgsl = null;
    static glsl = null;

    constructor(gal, input) {
        this.gal        = gal;
        this.input      = input;

        const flags      = this.getFlags(input);
        const locations  = this.getLocations(flags);
        const cacheKey   = `${this.constructor.name}:${JSON.stringify(flags)}`;

        const { vertShader, fragShader } = gal.generateShaders(this.constructor[this.gal.language], { input, flags, locations, cacheKey });

        this.flags      = flags;
        this.locations  = locations;
        this.vertShader = vertShader;
        this.fragShader = fragShader;

        this.#initPromise = this.init().then(() => this.#ready = true).catch(async (e) => {
            this.#error = e;
            for(const module of [this.vertShader, this.fragShader]) {
                const info = await module.compilationInfo();
                for(const msg of info.messages) {
                    if(msg.type === 'error') {
                        console.warn('Shader compilation error', `${msg.lineNum}:${msg.linePos} - ${msg.message}`);
                        if(msg.src) console.warn(msg.src.split(`\n`).map((line, i) => `${i + 1}: ${line}`).join('\n'));
                        return;
                    }
                }
            }
        });
    }

    get error() {
        return this.#error;
    }

    get ready() {
        return this.#ready;
    }

    get intialized() {
        return this.#initPromise;
    }

    run() {

    }

    getFlags() {
        return {};
    }

    getLocations() {
        return {};
    }

    async init(){

    }
}

export default Shader;