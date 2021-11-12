const GL = WebGL2RenderingContext;

export class RenderNode {
    #program;

    #width  = 0;
    #height = 0;

    scaleFactor = 1;

    square = false;

    output = {};

    capabilities = [];

    constructor(pipeline) {
        this.pipeline  = pipeline;
    }

    get width () {
        return this.#width;
    }

    get height () {
        return this.#height;
    }

    resize({ width, height }) {
        const { scaleFactor, square } = this;

        width  *= scaleFactor;
        height *= scaleFactor;

        if(square) {
            const min = Math.min(width, height);
            width  = min;
            height = min;
        }

        this.#width  = width;
        this.#height = height;

        this.fbo?.setup({ width, height });
    }

    enableCapabilities() {
        const { context: gl } = this.pipeline;
        for(const cap of this.capabilities) {
            gl.enable(cap);
        }
    }

    disableCapabilities() {
        const { context: gl } = this.pipeline;
        for(const cap of this.capabilities) {
            gl.disable(cap);
        }
    }

    clear() {
        const { context: gl } = this.pipeline;
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    start() {
        const { context: gl } = this.pipeline;
        
        this.fbo.bindFramebuffer();
        gl.viewport(0, 0, this.width, this.height);

        this.clear();
        this.enableCapabilities();
    }

    render({ graph, frustum, input = {} }) {
        const program = this.getProgram({ graph });
        program.run({ graph, frustum, input, output: this.output });
    }

    finish() {
        this.fbo.resolve?.();
        const { attachments } = this.fbo;
        const { context: gl } = this.pipeline;

        
        gl.viewport(0, 0, this.pipeline.width, this.pipeline.height);
        for(const texture of [...attachments.colors, attachments.depth, attachments.stencil] ) { 
            if(!texture || texture.disabled) continue;
            if(this.output[texture.name] && this.output[texture.name].type === 'texture') {
                const { glTexture, width, height } = texture;
                Object.assign(this.output[texture.name], { glTexture, width, height });
            }
            if(texture.mipmaps) {
                gl.bindTexture(gl.TEXTURE_2D, texture.glTexture);
                gl.generateMipmap(gl.TEXTURE_2D);
            }
        }

        this.disableCapabilities();
        return this.output;
    }

    // #temporalCount = 0;
    // temporalCoherence = 1;
    run({ graph, frustum, input = {} }) {
        // this.#temporalCount = (this.#temporalCount + 1) % this.temporalCoherence;
        // if(this.#temporalCount !== 0) return this.output; 

        this.start({ graph, frustum, input })
        this.render({ graph, frustum, input });
        return this.finish({ graph, frustum, input });
    }

    createProgram({ graph }) {
        const program = new (this.program)(this.pipeline.context, { graph, ...this });
        program.compile({ sync: true});
        return program;
    }
    
    getProgram({ graph }) {
        return this.#program || (this.#program = this.createProgram({ graph }));
    }

    reset() {
        this.#program = null;
        this.fbo?.reset();
    }
}

/**
 * A Geometry node will run a program for each primtive
 */
export class GeometryNode extends RenderNode {
    #programs = new WeakMap();

    capabilities = [GL.DEPTH_TEST];

    start({ graph, frustum, input = {} }) {
        super.start({ graph, frustum, input });

        if(this.lighting) {
            const { context: gl } = this.pipeline;
            const { environment } = graph;

            if(environment) {
                const textures = {
                    u_GGXEnvSampler:        environment.envGGXTexture.getWebGLTexture(gl),
                    u_CharlieEnvSampler:    environment.envCharlieTexture.getWebGLTexture(gl),
                    u_LambertianEnvSampler: environment.envLambertianTexture.getWebGLTexture(gl),
                    u_GGXLUT:               environment.lutTexture.getWebGLTexture(gl),
                    u_CharlieLUT:           environment.lutCharlieTexture.getWebGLTexture(gl),
                    u_SheenELUT:            environment.lutSheenETexture.getWebGLTexture(gl),
                }
    
                for(const [name, texture] of Object.entries(textures)) {
                    this.program.setCommonSampler(gl, name, texture);
                }
            }
            
            if(input.shadows) {
                this.program.setCommonSampler(gl, 'u_ShadowSamplers', input.shadows.glTexture);
            }

            if(input.ssao) {
                this.program.setCommonSampler(gl, 'u_SSAOSampler', input.ssao.glTexture);
            }

            if(input.transmission) {
                this.program.setCommonSampler(gl, 'u_TransmissionFramebufferSampler', input.transmission.glTexture);
            }
        }
    }
    
    render({ graph, frustum, input = {} }) {
        for(const { primitive, mesh, instances } of frustum.iterateBlocks({ transmissive: !this.opaque, alpha: !this.opaque })) {
            const program = this.getProgram({ primitive, mesh, graph });
            program.run({ frustum, instances, input });   
        }
    }

    clear() {
        const { context: gl } = this.pipeline;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    createProgram({ graph, primitive, mesh }) {
        const defines = { 
            LIGHT_COUNT: graph.lights.length, 
        } 
        return new (this.program)(this.pipeline.context, { primitive, mesh, graph, defines, settings: this.pipeline.settings });
    }
    
    getProgram({ graph, primitive, mesh }) {
        return this.#programs.get(primitive) || this.#programs.set(primitive, this.createProgram({ graph, primitive, mesh })).get(primitive);
    }

    reset() {
        this.#programs = new WeakMap();
        this.fbo?.reset();
    }
}

export default RenderNode;