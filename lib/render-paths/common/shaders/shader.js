/**
 * @todo split and cache vertext/fragment compilation
 */

import { NonNull } from '../../../../deps/utils.js';

/**
 * @typedef {{
 *  new (gal: import('../../../revgal.js').RevGAL, input: any): Shader,
 *  wgsl: { vertex: string, fragment: string }|((input: ShaderInitialized) => { vertex: string, fragment: string }),
 *  glsl: { vertex: string, fragment: string }|((input: ShaderInitialized) => { vertex: string, fragment: string }),
 *  debugPrintShaders?: boolean
 * }} ShaderConstructor
 */

/**
 * @template {Shader} [T=any]
 * @typedef {{
 *  flags:     NonNullable<ReturnType<T['getFlags']>>,
 *  uniforms:  NonNullable<ReturnType<T['getUniforms']>>,
 *  locations: NonNullable<ReturnType<T['getLocations']>>,
 *  hints:     NonNullable<ReturnType<T['getHints']>>,
 *  cacheKey:  NonNullable<ReturnType<T['getCacheKey']>>,
 * } & T} ShaderInitialized
 */

/**
 * @template {Shader} [T=any]
 * @typedef {{
 *  stages:                   NonNullable<ReturnType<import('../../../revgal.js').RevGAL['generateShaders']>['stages']>,
 *  renderPipelineDescriptor: NonNullable<ReturnType<T['getRenderPipelineDescriptor']>>,
 *  compiled:                 NonNullable<T['compiled']>,
 * } & ShaderInitialized<T> & T} ShaderCompiled
 */

/**
 * @template {Record<string, any>} [I = Record<string, any>]
 */
export class Shader {
    /**
     * @type {string|((input: ShaderInitialized) => { vertex: string, fragment: string })}
     */
    static wgsl = '';
    /**
     * @type {string|((input: ShaderInitialized) => { vertex: string, fragment: string })}
     */
    static glsl = '';

    /**
     * @type {Error|null}
     */
    #error = null;

    /**
     * @type {Promise<ShaderCompiled<this>>|null}
     */
    #compilePromise = null;

    /**
     * @type {{ vertex: string, fragment: string }|null}
     */
    #source = null;

    /**
     * @type {ReturnType<import('../../../revgal.js').RevGAL['generateShaders']>['stages']|null}
     */
    stages = null;

    /**
     * @type {import('../../../revgal.js').REVRenderPipelineDescriptor|null}
     */
    renderPipelineDescriptor = null;

    /**
     * @type {import('../../../revgal.js').REVRenderPipeline|null}
     */
    renderPipeline = null;

    /**
     * @type {import('../../../revgal.js').REVBindGroup|null}
     */
    bindGroup = null;

    /**
     * @param {import('../../../revgal.js').RevGAL} gal
     * @param {I} input
     */
    constructor(gal, input) {
        this.gal   = gal;
        this.input = input;
    }

    /**
     * @return {asserts this is ShaderInitialized<this>}
     */
    #init() {
        this.flags      = this.getFlags();
        this.uniforms   = this.getUniforms();
        this.locations  = this.getLocations();
        this.hints      = this.getHints();
        this.cacheKey   = this.getCacheKey();
    }

    /**
     * @returns {asserts this is ShaderCompiled<this>}
     */
    #compile() {
        this.#init();

        this.flags

        const { stages, source } = this.gal.generateShaders(/** @type {ShaderConstructor} */(this.constructor), this);

        this.stages  = stages;
        this.#source = source;

        this.renderPipelineDescriptor = this.getRenderPipelineDescriptor(stages);
    }

    compile() {
        this.#compile();

        try {
            this.renderPipeline = this.gal.createPipelineFromCache({ cacheKey: this.cacheKey, descriptor: this.renderPipelineDescriptor })
        } catch(e) {
            console.warn(e);
            this.#error = /** @type {Error} */(e);
            this.outputCompilationErrors();
            throw e;
        } finally {
            this.#source = null;
        }

        return this;
    }

    compileAsync() {
        this.#compile();

        this.#compilePromise = this.gal.createPipelineFromCacheAsync({ cacheKey: this.cacheKey, descriptor: this.renderPipelineDescriptor }).then(renderPipeline => {
            this.renderPipeline = renderPipeline;
            return this;
        }).catch(async (e) => {
            console.warn(e);
            this.#error = e;
            await this.outputCompilationErrors();
            throw e;
        }).finally(() => {
            this.#source = null;
        });

        return this;
    }

    async outputCompilationErrors() {
        const stages = NonNull(this.stages, 'Shader has not been compiled');

        for(const stage of /** @type {(keyof stages)[]} */(Object.keys(stages))) {
            const module = stages[stage];

            const info = await module.getCompilationInfo();
            for(const msg of info.messages) {
                if(msg.type === 'error') {
                    console.warn('Shader compilation error', `${msg.lineNum}:${msg.linePos} - ${msg.message}`);

                    if(this.#source) { // Try to print useful information to the console
                        const lines = this.#source[stage].split(`\n`).map((line, i) => `${i + 1}: ${line}`);
                        console.log('%c' + lines.slice(0, msg.lineNum - 1).join('\n'), 'color: grey;');
                        console.log(`%c${new Array(msg.lineNum.toString().length).fill('>').join('')}: ${msg.message}`, 'color: red;');
                        console.log('%c' + lines.slice(msg.lineNum - 1, msg.lineNum).join('\n'), 'color: yellow;');
                        console.log('%c' + lines.slice(msg.lineNum).join('\n'), 'color: grey;');
                    }
                }
            }
        }
    }

    get error() {
        return this.#error;
    }

    get compiled() {
        return this.#compilePromise;
    }

    /**
     *
     * @param {import('../../../revgal.js').REVRenderPassEncoder} renderPassEncoder
     * @param {...any} args
     */
    run(renderPassEncoder, ...args) {

    }

    getCacheKey() {
        return `${this.constructor.name}:${JSON.stringify(this.flags)}:${JSON.stringify(this.locations)}`;
    }

    /** @return {Record<string, any>} */
    getFlags() {
        return {};
    }

    /** @return {Record<string, import('../../../ubo.js').UBO>} */
    getUniforms() {
        return {};
    }

    /** @return {Record<string, any>} */
    getLocations() {
        return {};
    }

    /** @return {import('../../../revgal.js').REVShaderModuleCompilationHint[]} */
    getHints() {
        return [];
    }

    /**
     * @param {ReturnType<import('../../../revgal.js').RevGAL['generateShaders']>['stages']} stages
     * @return {import('../../../revgal.js').REVRenderPipelineDescriptor}
     */
    getRenderPipelineDescriptor(stages) {
        throw new Error('Not implemented');
    }
}
