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
        internalFormat: GL.DEPTH_COMPONENT16, 
        format: GL.DEPTH_COMPONENT, 
        type: GL.UNSIGNED_SHORT,
    }
}

export class RenderNode {
    #programs;

    #width = 0;
    #height = 0;
    
    static scaleFactor = 1;
    static square = false;
    static multisample = false;

    static output = {};

    constructor(pipeline) {
        this.pipeline = pipeline;

        this.output = {};

        this.createOutputTextures();
        this.clearProgramCache();

        if(this.constructor.multisample) { /** Create an additional framebuffer set to blit to after render */
            this.msaa = new MSAANode(this.pipeline);
        }
    }

    get width () {
        return this.#width;
    }

    get height () {
        return this.#height;
    }

    getOutputTextureInfos() {
        return Object.entries(this.constructor.output).filter(([, { type }]) => type === 'texture');
    }
    createOutputTextures() {
        const { context: gl } = this.pipeline;


        for(const [name, textureInfo] of this.getOutputTextureInfos()) {


            const { min, mag, wrapS, wrapT, compareFunc, compareMode } = { ...defaultParams[textureInfo.attachmentType], ...textureInfo.params };

            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mag);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,     wrapS);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,     wrapT);
            if(compareFunc) gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, compareFunc);
            if(compareMode) gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, compareMode);

            gl.bindTexture(gl.TEXTURE_2D, null);

            this.output[name] = { glTexture: texture };
        }
    }

    createFramebuffer() {        
        const { context: gl   } = this.pipeline;
        const { width, height } = this;

        gl.deleteFramebuffer(this.framebuffer);

        const framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

        let colors = 0;
        for(const [name, textureInfo] of this.getOutputTextureInfos()) {

            const texture = this.output[name].glTexture;

            gl.bindTexture(gl.TEXTURE_2D, texture);

            const { internalFormat, format, type } = { ...defaultParams[textureInfo.attachmentType], ...textureInfo.params };

            const attachment = textureInfo.attachmentType === 'color' ? gl.COLOR_ATTACHMENT0 + colors++ : gl.DEPTH_ATTACHMENT;
            gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, texture, 0);

            this.output[name].width = width;
            this.output[name].height = height;
        }

        gl.drawBuffers([...new Array(colors).keys()].map(i => gl.COLOR_ATTACHMENT0 + i));

        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if(status != gl.FRAMEBUFFER_COMPLETE){
            console.warn('Framebuffer error:', this.constructor.name, RenderNode.GL_FRAMEUBUFFER_STATUS_ERRORS[status]);
        }

        this.framebuffer = framebuffer;

        if(this.constructor.multisample) {
            this.createRenderbuffers();
        }

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    createRenderbuffers() {
        const { context: gl   } = this.pipeline;
        const { width, height } = this;

        if(this.renderbuffers) {
            for(const renderbuffer of this.renderbuffers) {
                gl.deleteRenderbuffer(renderbuffer);
            }
        }
        this.renderbuffers = [];

        let colors = 0;
        for(const [name, textureInfo] of this.getOutputTextureInfos()) {
            const renderbuffer = gl.createRenderbuffer();

            let attachment, format;
            if(textureInfo.attachmentType === 'color') {
                attachment = gl.COLOR_ATTACHMENT0 + colors++;
                format = gl.RGBA8;
            } else if (textureInfo.attachmentType === 'depth') {
                attachment =  gl.DEPTH_ATTACHMENT;
                format =  gl.DEPTH_COMPONENT16;
            }

            gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
            /** @todo: make sample number configurable */
            gl.renderbufferStorageMultisample(gl.RENDERBUFFER, 4, format, width, height);

            gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, attachment, gl.RENDERBUFFER, renderbuffer);
            this.renderbuffers.push(renderbuffer);
        }
        
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if(status != gl.FRAMEBUFFER_COMPLETE){
            console.warn('Renderbuffer error:', this.constructor.name, RenderNode.GL_FRAMEUBUFFER_STATUS_ERRORS[status]);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    resize({ width, height }) {
        const { scaleFactor, square } = this.constructor;

        width *= scaleFactor;
        height *= scaleFactor;

        if(square) {
            const min = Math.min(width, height);
            width = min;
            height = min;
        }

        this.#width = width;
        this.#height = height;

        this.createFramebuffer();

        this.msaa?.resize({ width, height });
    }

    render(graph, input) {
        const { context: gl } = this.pipeline;

        const { type } = this.constructor;

        const { framebuffer } = this;

        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.viewport(0, 0, this.width, this.height);
        
        if(type === 'geometry') {
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); 
            gl.enable(gl.DEPTH_TEST);
            gl.enable(gl.CULL_FACE);
    
            for(const { primitive, node, opaque } of graph.primitives) {
                if(this.constructor.opaque){
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
        for(const [name, textureInfo] of this.getOutputTextureInfos()) {
            if(textureInfo.mipmaps) {
                gl.bindTexture(gl.TEXTURE_2D, this.output[name].glTexture);
                gl.generateMipmap(gl.TEXTURE_2D);
            }
        }

        if(this.constructor.multisample) {
            this.blitFramebuffer(this, this.msaa);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        return this.output;
    }

    createPrimitiveProgram(primitive, node, graph) {
        return new (this.constructor.program)(this.pipeline.context, primitive, node, graph);
    }

    renderPrimitive(primitive, node, graph, input) {
        const program = this.getPrimitiveProgram(primitive, node, graph);
        program.run(primitive, node, graph, input, this.output);
    }
    
    getPrimitiveProgram(primitive, node, graph) {
        return this.#programs.get(primitive) || this.#programs.set(primitive, this.createPrimitiveProgram(primitive, node, graph)).get(primitive);
    }

    createScreenProgram(graph) {
        return new (this.constructor.program)(this.pipeline.context, graph, this);
    }

    renderScreen(graph, input) {
        const program = this.getScreenProgram(graph);
        program.run(graph, input, this.output);
    }
    
    getScreenProgram(graph) {
        return this.#programs.get(this) || this.#programs.set(this, this.createScreenProgram(graph)).get(this);
    }

    clearProgramCache() {
        this.#programs = new WeakMap();
        if(this.postprocess) {
            for(const pass of this.postprocess) {
                pass.clearProgramCache();
            }
        }
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


/**
 * The MSAA Node is not meant to be used directly. It is automatically created when multisample is set to true on a RenderNode class.
 * After rendering to the RenderNode framebuffer, the framebuffer will be blit to the MSAANode's framebuffer found on the msaa property of the RenderNode.
 */
class MSAANode extends RenderNode {
    static output = {
        color: { type: 'texture', attachmentType: 'color' },
    };
}

export default RenderNode;