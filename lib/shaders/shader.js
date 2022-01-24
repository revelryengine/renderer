/**
 * @todo split and cache vertext/fragment compilation
 */

 export class Shader {
    #error;
    #ready;

    static wgsl = null;
    static glsl = null;

    constructor(gal, input) {
        this.gal        = gal;
        this.input      = input;

        const flags      = this.getFlags(input);
        const locations  = this.getLocations(flags);

        const cacheKey = `${this.constructor.name}:${JSON.stringify(flags)}`;

        const { vertShader, fragShader } = gal.generateShaders(this.constructor, { input, flags, locations, cacheKey });

        this.flags      = flags;
        this.locations  = locations;
        this.vertShader = vertShader;
        this.fragShader = fragShader;

        this.checkCompilation();
    }

    async checkCompilation() {
        for(const module of [this.vertShader, this.fragShader]) {
            const info = await this.gal.checkCompilation(module);
            for(const msg of info.messages) {
                if(msg.type === 'error') {
                    this.#error = `${msg.lineNum}:${msg.linePos} - ${msg.message}`;
                    console.warn('Shader compilation error', this.#error);
                    if(msg.src) console.warn(msg.src.split(`\n`).map((line, i) => `${i + 1}: ${line}`).join('\n'));
                    return;
                }
            }
        }
        this.#ready = true;
        return;
    }

    get error() {
        return this.#error;
    }

    get ready() {
        return this.#ready;
    }

    run() {

    }

    getFlags() {
        return {};
    }

    getLocations() {
        return {};
    }
}

export default Shader;