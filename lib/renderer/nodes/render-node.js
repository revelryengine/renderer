const GL = WebGL2RenderingContext;

const defaultParams = {
    color: {
        min: GL.LINEAR,
        mag: GL.NEAREST,
        wrapS: GL.CLAMP_TO_EDGE,
        wrapT: GL.CLAMP_TO_EDGE,
        internalFormat: GL.RGBA, 
        format: GL.RGBA, 
        type: GL.UNSIGNED_BYTE,
    },
    depth: {
        min: GL.NEAREST,
        mag: GL.NEAREST,
        wrapS: GL.CLAMP_TO_EDGE,
        wrapT: GL.CLAMP_TO_EDGE,
        internalFormat: GL.DEPTH_COMPONENT32F, 
        format: GL.DEPTH_COMPONENT, 
        type: GL.FLOAT,
    },
}

export class RenderNode {
    #programs;

    #width = 0;
    #height = 0;

    #attachments;

    scaleFactor = 1;
    square = false;
    multisample = false;

    textures = [];

    output = {};

    constructor(pipeline) {
        this.pipeline  = pipeline;
        this.#programs = new WeakMap();
    }

    get width () {
        return this.#width;
    }

    get height () {
        return this.#height;
    }

    createTextures() {
        const { context: gl } = this.pipeline;

        this.#attachments = [];
        for(const texture of this.textures) {
            if(texture.type === 'color') this.#attachments.push(gl.COLOR_ATTACHMENT0 + this.#attachments.length);
            if(texture.glTexture) continue;

            texture.glTexture = this.createTexture(texture);

            if(this.multisample){
                texture.msTexture = this.createTexture(texture);
            }
        }
    }

    createFramebuffers() {
        this.framebuffer = this.createFramebuffer(this.framebuffer);

        if(this.multisample) {
            this.msFramebuffer   = this.createFramebuffer(this.msFramebuffer, true);
            this.msRenderbuffers = this.createRenderbuffers(this.msFramebuffer, this.msRenderbuffers);
        }
    }

    createTexture(texture) {
        const { context: gl } = this.pipeline;
        const { min, mag, wrapS, wrapT, compareFunc, compareMode, array } = { ...defaultParams[texture.type], ...texture.params };

        const glTexture = gl.createTexture();
        const target = array ? gl.TEXTURE_2D_ARRAY : gl.TEXTURE_2D;
        gl.bindTexture(target, glTexture);
        gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, min);
        gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, mag);
        gl.texParameteri(target, gl.TEXTURE_WRAP_S,     wrapS);
        gl.texParameteri(target, gl.TEXTURE_WRAP_T,     wrapT);
        if(compareFunc) gl.texParameteri(target, gl.TEXTURE_COMPARE_FUNC, compareFunc);
        if(compareMode) gl.texParameteri(target, gl.TEXTURE_COMPARE_MODE, compareMode);

        gl.bindTexture(target, null);
        return glTexture;
    }

    createFramebuffer(originalFramebuffer, multisample = false) { 
        const { context: gl   } = this.pipeline;
        const { width, height } = this;

        gl.deleteFramebuffer(originalFramebuffer);

        const framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

        let colors = 0;
        for(const texture of this.textures) {
            const { internalFormat, format, type, array, depth = 4 } = { ...defaultParams[texture.type], ...texture.params };
            const { glTexture, msTexture } = texture;
            
            const target = array ? gl.TEXTURE_2D_ARRAY : gl.TEXTURE_2D;

            const targetTexture = multisample ? msTexture : glTexture;

            gl.bindTexture(target, targetTexture);

            let attachment;
            if(texture.type === 'color') {
                attachment = gl.COLOR_ATTACHMENT0 + colors++;
            } else if(texture.type === 'depth') {
                attachment = gl.DEPTH_ATTACHMENT;
            }

            if(target === gl.TEXTURE_2D_ARRAY) {
                gl.texImage3D(target, 0, internalFormat, width, height, depth, 0, format, type, null);
            } else {
                gl.texImage2D(target, 0, internalFormat, width, height, 0, format, type, null);
            }
            
            gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, target, targetTexture, 0);
            
            texture.width = width;
            texture.height = height;

            gl.bindTexture(target, null);
        }

        gl.drawBuffers(this.#attachments);

        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if(status != gl.FRAMEBUFFER_COMPLETE){
            console.warn('Framebuffer error:', this.constructor.name, RenderNode.GL_FRAMEUBUFFER_STATUS_ERRORS[status]);
        }
    
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        return framebuffer;
    }

    createRenderbuffers(framebuffer, originalRenderbuffers) {
        const { context: gl   } = this.pipeline;
        const { width, height } = this;

        const maxSamples = gl.getParameter(gl.MAX_SAMPLES);

        if(originalRenderbuffers) {
            for(const renderbuffer of originalRenderbuffers) {
                gl.deleteRenderbuffer(renderbuffer);
            }
        }

        const renderbuffers = [];

        let colors = 0;
        for(const texture of this.textures) {
            const { type } = texture;

            let attachment, format;
            if(type === 'color') {
                attachment = gl.COLOR_ATTACHMENT0 + colors++;
                format = gl.RGBA8;
            } else if (type === 'depth') {
                attachment = gl.DEPTH_ATTACHMENT;
                format = gl.DEPTH_COMPONENT32F;
            }

            const renderbuffer = gl.createRenderbuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
            gl.renderbufferStorageMultisample(gl.RENDERBUFFER, maxSamples, format, width, height);
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, attachment, gl.RENDERBUFFER, renderbuffer);

            renderbuffers.push(renderbuffer);
        }
        
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if(status != gl.FRAMEBUFFER_COMPLETE){
            console.warn('Renderbuffer error:', this.constructor.name, RenderNode.GL_FRAMEUBUFFER_STATUS_ERRORS[status]);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        return renderbuffers;
    }

    resize({ width, height }) {
        const { scaleFactor, square } = this;

        width *= scaleFactor;
        height *= scaleFactor;

        if(square) {
            const min = Math.min(width, height);
            width = min;
            height = min;
        }

        this.#width = width;
        this.#height = height;

        this.createTextures();
        this.createFramebuffers();
    }

    render(graph, input = {}) {
        const { context: gl } = this.pipeline;
        const { type, framebuffer, msFramebuffer } = this;

        gl.bindFramebuffer(gl.FRAMEBUFFER, msFramebuffer || framebuffer);
        gl.viewport(0, 0, this.width, this.height);
        
        if(type === 'geometry') {
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); 
            gl.enable(gl.DEPTH_TEST);
            gl.enable(gl.CULL_FACE);
    
            for(const { primitive, node, opaque } of graph.primitives) {
                if(this.opaque){
                    if(!opaque || primitive.material?.extensions?.KHR_materials_transmission) break;
                }
                this.renderPrimitive(primitive, node, graph, input);
            }
        } else if (type === 'screen') {
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.disable(gl.DEPTH_TEST);

            this.renderScreen(graph, input);
        }

        const { viewInfo: { viewport } } = graph;

        gl.viewport(0, 0, viewport.width, viewport.height);
        for(const texture of this.textures) {
            if(texture.mipmaps) {
                gl.bindTexture(gl.TEXTURE_2D, texture.msTexture || texture.glTexture);
                gl.generateMipmap(gl.TEXTURE_2D);
            }
        }

        if(this.multisample) {
            let colors = 0;
            for(const texture of this.textures) {
                const { type } = texture;

                if(type === 'color'){
                    const attachment = gl.COLOR_ATTACHMENT0 + colors++;

                    gl.bindFramebuffer(gl.FRAMEBUFFER, msFramebuffer);
                    gl.readBuffer(attachment);

                    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
                    gl.drawBuffers(this.#attachments.map((a) => attachment === a ? a : gl.NONE));
                    
                    this.blitFramebuffer({ width: this.width, height: this.height, framebuffer: this.msFramebuffer }, this);
                }
            }
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            gl.drawBuffers(this.#attachments);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        //copy textures to output
        for(const texture of this.textures) { 
            if(this.output[texture.name] && this.output[texture.name].type === 'texture') {
                const { glTexture, width, height } = texture;
                Object.assign(this.output[texture.name], { glTexture, width, height });
            }
        }

        return this.output;
    }

    createPrimitiveProgram(primitive, node, graph) {
        return new (this.program)(this.pipeline.context, primitive, node, graph);
    }

    renderPrimitive(primitive, node, graph, input) {
        const program = this.getPrimitiveProgram(primitive, node, graph);
        program.run(primitive, node, graph, input, this.output);
    }
    
    getPrimitiveProgram(primitive, node, graph) {
        return this.#programs.get(primitive) || this.#programs.set(primitive, this.createPrimitiveProgram(primitive, node, graph)).get(primitive);
    }

    createScreenProgram(graph) {
        return new (this.program)(this.pipeline.context, graph, this);
    }

    renderScreen(graph, input) {
        const program = this.getScreenProgram(graph);
        program.run(graph, input, this.output);
    }
    
    getScreenProgram(graph) {
        return this.#programs.get(this) || this.#programs.set(this, this.createScreenProgram(graph)).get(this);
    }

    reset() {
        this.#programs = new WeakMap();
        this.createTextures(); 
        this.createFramebuffers();
    }
    
    blitFramebuffer() {
        RenderNode.blitFramebuffer(this.pipeline.context, ...arguments);
    }

    /**
     * Convenience method to blit a framebuffer based on width/height rather than srcX1/srcY1 and dstX1/dstY1
     */
    static blitFramebuffer(context, src, dst, mask = GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT, filter = GL.NEAREST) {
        const gl = context;

        const { framebuffer: srcFramebuffer, x: srcX0 = 0, y: srcY0 = 0, width: srcWidth, height: srcHeight } = src;
        const { framebuffer: dstFramebuffer, x: dstX0 = 0, y: dstY0 = 0, width: dstWidth, height: dstHeight } = dst;

        const srcX1 = srcX0 + srcWidth, srcY1 = srcY0 + srcHeight;
        const dstX1 = dstX0 + dstWidth, dstY1 = dstY0 + dstHeight;

        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, srcFramebuffer);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dstFramebuffer || null); // null when dst is canvas element

        gl.blitFramebuffer(
            srcX0, srcY0, srcX1, srcY1,
            dstX0, dstY0, dstX1, dstY1,
            mask, filter
        );

        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    }

    static GL_FRAMEUBUFFER_STATUS_ERRORS = {
        [GL.FRAMEBUFFER_UNSUPPORTED]:                   'FRAMEBUFFER_UNSUPPORTED',
        [GL.FRAMEBUFFER_INCOMPLETE_ATTACHMENT]:         'FRAMEBUFFER_INCOMPLETE_ATTACHMENT',
        [GL.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT]: 'FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT',
        [GL.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE]:        'FRAMEBUFFER_INCOMPLETE_MULTISAMPLE',
    }
}

export default RenderNode;