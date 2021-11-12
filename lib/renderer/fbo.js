const GL = WebGL2RenderingContext;

const defaultParams = {
    color: {
        min: GL.NEAREST, mag: GL.NEAREST, wrapS: GL.CLAMP_TO_EDGE, wrapT: GL.CLAMP_TO_EDGE,
        internalFormat: GL.RGBA, renderFormat: GL.RGBA8, format: GL.RGBA, type: GL.UNSIGNED_BYTE,
    },
    depth: {
        min: GL.NEAREST, mag: GL.NEAREST, wrapS: GL.CLAMP_TO_EDGE, wrapT: GL.CLAMP_TO_EDGE,
        internalFormat: GL.DEPTH_COMPONENT32F, renderFormat: GL.DEPTH_COMPONENT32F, format: GL.DEPTH_COMPONENT, type: GL.FLOAT,
    },
    stencil: {
        min: GL.NEAREST, mag: GL.NEAREST, wrapS: GL.CLAMP_TO_EDGE, wrapT: GL.CLAMP_TO_EDGE, 
        internalFormat: GL.DEPTH24_STENCIL8, renderFormat: GL.DEPTH24_STENCIL8, format: GL.DEPTH_STENCIL, type: GL.UNSIGNED_INT_24_8,
    },
}

export class FBO {
    #width   = 0;
    #height  = 0;
    #samples = 1;
    
    renderbuffers = [];
    constructor(context, { colors = [], depth, stencil } = {}) {
        this.context = context;
        this.attachments = JSON.parse(JSON.stringify({ colors, depth, stencil }));
    }

    get width() {
        return this.#width;
    }

    get height () {
        return this.#height;
    }

    get samples () {
        return this.#samples;
    }

    setup({ width, height, samples = 1 }) {
        this.#width   = width;
        this.#height  = height;
        this.#samples = samples;

        this.createFramebuffer();
        if(this.#samples > 1) this.createRenderbuffers(this.#samples);
    }

    reset() {
        this.createFramebuffer();
        if(this.#samples > 1) this.createRenderbuffers(this.#samples);
    }

    createFramebuffer() { 
        const { context: gl } = this;

        gl.deleteFramebuffer(this.framebuffer);

        this.framebuffer = gl.createFramebuffer();
        const { attachments } = this;
        for(let i = 0; i < attachments.colors.length; i++) {
            if(attachments.colors[i].disabled) continue;
            this.attachTexture('color', attachments.colors[i], gl.COLOR_ATTACHMENT0 + i);
        }
        if(attachments.depth && !attachments.depth.disabled)   this.attachTexture('depth',   attachments.depth,   gl.DEPTH_ATTACHMENT);
        if(attachments.stencil && !attachments.stencil.disabled) this.attachTexture('stencil', attachments.stencil, gl.DEPTH_STENCIL_ATTACHMENT);

        this.setDrawbuffers();
        this.checkFramebufferStatus();
        return this.framebuffer;
    }

    createTexture(textureType, texture) {
        const { context: gl } = this;
        const { min, mag, wrapS, wrapT, compareFunc, compareMode, array } = { ...defaultParams[textureType], ...texture.params };

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

    attachTexture(textureType, texture, attachment) {
        const { context: gl, width, height } = this;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);

        if(!texture.glTexture) texture.glTexture = this.createTexture(textureType, texture);

        const { internalFormat, format, type, array, depth = 4 } = { ...defaultParams[textureType], ...texture.params };
        const { glTexture } = texture;
        
        const target = array ? gl.TEXTURE_2D_ARRAY : gl.TEXTURE_2D;

        gl.bindTexture(target, glTexture);

        if(target === gl.TEXTURE_2D_ARRAY) {
            gl.texImage3D(target, 0, internalFormat, width, height, depth, 0, format, type, null);
        } else {
            gl.texImage2D(target, 0, internalFormat, width, height, 0, format, type, null);
        }
        
        gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, target, glTexture, 0);
        
        texture.width  = width;
        texture.height = height;

        gl.bindTexture(target, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    setDrawbuffers(buffers) {
        const { context: gl } = this;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.drawBuffers(buffers || this.attachments.colors.map((color, i) => color.disabled ? null : gl.COLOR_ATTACHMENT0 + i));
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    checkFramebufferStatus() {
        const { context: gl } = this;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if(status != gl.FRAMEBUFFER_COMPLETE){
            throw new Error(`Framebuffer error: ${FBO.GL_FRAMEUBUFFER_STATUS_ERRORS[status]}`);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    createRenderbuffers(samples) {
        const { context: gl } = this;

        samples = Math.min(samples, gl.getParameter(gl.MAX_SAMPLES));

        for(const renderbuffer of this.renderbuffers) {
            gl.deleteRenderbuffer(renderbuffer);
        }

        this.renderbuffers.length = 0;

        const { attachments } = this;
        for(let i = 0; i < attachments.colors.length; i++) {
            if(attachments.colors[i].disabled) continue;
            this.attachRenderbuffer('color', attachments.colors[i], gl.COLOR_ATTACHMENT0 + i, samples);
        }
        if(attachments.depth && !attachments.depth.disabled)   this.attachRenderbuffer('depth',   attachments.depth,   gl.DEPTH_ATTACHMENT, samples);
        if(attachments.stencil && !attachments.stencil.disabled) this.attachRenderbuffer('stencil', attachments.stencil, gl.DEPTH_STENCIL_ATTACHMENT, samples);

        this.checkFramebufferStatus();

        return this.renderbuffers;
    }

    attachRenderbuffer(textureType, texture, attachment, samples) {
        const { context: gl, framebuffer, width, height } = this;

        const { renderFormat } = { ...defaultParams[textureType], ...texture.params };

        const renderbuffer = gl.createRenderbuffer();

        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, renderFormat, width, height);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, attachment, gl.RENDERBUFFER, renderbuffer);

        this.renderbuffers.push(renderbuffer);
    }

    blitFramebuffer(dst, mask, filter) {
        return FBO.blitFramebuffer(this.context, this, dst, mask, filter);
    }

    bindFramebuffer() {
        const { context: gl } = this;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    }

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

export class MSFBO extends FBO {
    constructor(context, attachments) {
        super(context, attachments);
        this.unresolved = new FBO(context, attachments);
    }

    get samples() {
        return this.unresolved.samples;
    }

    setup({ width, height }) {
        super.setup({ width, height });
        this.unresolved.setup({ width, height, samples: 8 });
    }

    reset() {
        super.reset();
        this.unresolved.reset();
    }

    resolve() {
        this.unresolved.blitFramebuffer(this);
    }

    bindFramebuffer() {
        this.unresolved.bindFramebuffer();
    }
}

export default FBO;