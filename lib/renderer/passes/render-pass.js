import { Texture } from '../../texture.js';

const GL = WebGL2RenderingContext;

const defaults = {
    color: {
        min: GL.LINEAR_MIPMAP_LINEAR,
        internalFormat: GL.RGBA, 
        format: GL.RGBA, 
        type: GL.UNSIGNED_BYTE,
    },
    depth: {
        min: GL.NEAREST,
        internalFormat: GL.DEPTH_COMPONENT16, 
        format: GL.DEPTH_COMPONENT, 
        type: GL.UNSIGNED_SHORT,
    }
}

export class RenderPass {
    #programs;

    static output = { scaleFactor: 1, powerOf2: false, textures: [] };

    constructor(name, context) {
        this.name = name;
        this.context  = context;

        const { scaleFactor = 1, powerOf2 = false } = this.constructor.output;

        this.output = { scaleFactor, powerOf2, textures: {}, width: 0, height: 0 };

        this.createOutputTextures();
        this.clearProgramCache();
    }

    createOutputTextures() {
        const { context: gl } = this;

        for(const textureInfo of this.constructor.output.textures) {
            const { type } = textureInfo;

            const { 
                name, 
                min = defaults[type].min, 
                mag = GL.NEAREST, 
                wrapS = GL.CLAMP_TO_EDGE, 
                wrapT = GL.CLAMP_TO_EDGE,
            } = textureInfo;

            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mag);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,     wrapS);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,     wrapT);
            gl.bindTexture(gl.TEXTURE_2D, null);

            this.output.textures[name] = texture;
        }
    }

    createOutputFramebuffer() {
        if(this.constructor.type === 'output') return;
        
        const { context: gl   } = this;
        const { width, height } = this.output;
        const { textures      } = this.constructor.output;

        gl.deleteFramebuffer(this.output.framebuffer);

        const framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

        let colors = 0;
        for(const textureInfo of textures) {
            const { name } = textureInfo;

            const texture = this.output.textures[name];
            gl.bindTexture(gl.TEXTURE_2D, texture);

            const { internalFormat, format, type } = { ...textureInfo, ...defaults[textureInfo.type]};

            const attachment = textureInfo.type === 'color' ? gl.COLOR_ATTACHMENT0 + colors++ : gl.DEPTH_ATTACHMENT;
            gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, texture, 0);
        }

        gl.drawBuffers([...new Array(colors).keys()].map(i => gl.COLOR_ATTACHMENT0 + i));

        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if(status != gl.FRAMEBUFFER_COMPLETE){
            console.warn('Framebuffer error:', this.constructor.name, RenderPass.GL_FRAMEUBUFFER_STATUS_ERRORS[status]);
        }

        this.output.framebuffer = framebuffer;

        if(this.constructor.output.multisample) {
            this.createOutputRenderbuffers();
        }

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    createOutputRenderbuffers() {
        const { context: gl   } = this;
        const { width, height } = this.output;
        const { textures      } = this.constructor.output;

        if(this.output.renderbuffers) {
            for(const renderbuffer of this.output.renderbuffers) {
                gl.deleteRenderbuffer(renderbuffer);
            }
        }
        this.output.renderbuffers = [];

        let colors = 0;
        for(const textureInfo of textures) {
            const renderbuffer = gl.createRenderbuffer();

            let attachment, format;
            if(textureInfo.type === 'color') {
                attachment = gl.COLOR_ATTACHMENT0 + colors++;
                format = gl.RGBA8;
            } else if (textureInfo.type === 'depth') {
                attachment =  gl.DEPTH_ATTACHMENT;
                format =  gl.DEPTH_COMPONENT16;
            }

            gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
            /** @todo: make sample number configurable */
            gl.renderbufferStorageMultisample(gl.RENDERBUFFER, 4, format, width, height);

            gl.bindFramebuffer(gl.FRAMEBUFFER, this.output.framebuffer);
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, attachment, gl.RENDERBUFFER, renderbuffer);
            this.output.renderbuffers.push(renderbuffer);
        }
        
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if(status != gl.FRAMEBUFFER_COMPLETE){
            console.warn('Renderbuffer error:', this.constructor.name, RenderPass.GL_FRAMEUBUFFER_STATUS_ERRORS[status]);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    #widthCache = 0;
    #heightCache = 0;
    resize({ width, height }) {
        if(this.#widthCache !== width || this.#heightCache !== height) {

            this.#widthCache  = width;
            this.#heightCache = height;

            width  *= this.output.scaleFactor;
            height *= this.output.scaleFactor;

            if(this.output.powerOf2) {
                width  = Texture.nearestUpperPowerOf2(width);
                height = Texture.nearestUpperPowerOf2(height);
            }

            this.output.width = width;
            this.output.height = height;
    
            this.createOutputFramebuffer();
        }
        
    }

    render(graph) {
        const { context: gl } = this;

        const { type } = this.constructor;

        const { framebuffer } = this.output;
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.viewport(0, 0, this.output.width, this.output.height);
        
        if(type === 'geometry') {
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); 
            gl.enable(gl.DEPTH_TEST);
    
            for(const { primitive, node, opaque } of graph.primitives) {
                if(this.constructor.opaque){
                    if(!opaque || primitive.material?.extensions?.KHR_materials_transmission) break;
                }
                this.renderPrimitive(primitive, node, graph);
            }
        } else if (type === 'screen') {
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.disable(gl.DEPTH_TEST);

            this.renderScreen(graph);
        }

        const { viewInfo: { viewport } } = graph;

        gl.viewport(0, 0, viewport.width, viewport.height);
        for(const textureInfo of this.constructor.output.textures) {
            if(textureInfo.mipmaps) {
                gl.bindTexture(gl.TEXTURE_2D, this.output.textures[textureInfo.name]);
                gl.generateMipmap(gl.TEXTURE_2D);
            }
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        return this.output;
    }

    createPrimitiveProgram(primitive, node, graph) {
        return new (this.constructor.program)(this.context, primitive, node, graph);
    }

    renderPrimitive(primitive, node, graph) {
        const program = this.getPrimitiveProgram(primitive, node, graph);
        program.run(primitive, node, graph, this);
    }
    
    getPrimitiveProgram(primitive, node, graph) {
        return this.#programs.get(primitive) || this.#programs.set(primitive, this.createPrimitiveProgram(primitive, node, graph)).get(primitive);
    }

    createScreenProgram(graph) {
        return new (this.constructor.program)(this.context, graph, this);
    }

    renderScreen(graph) {
        const program = this.getScreenProgram(graph);
        program.run(graph, this);
    }
    
    getScreenProgram(graph) {
        return this.#programs.get(this) || this.#programs.set(this, this.createScreenProgram(graph)).get(this);
    }

    clearProgramCache() {
        this.#programs = new WeakMap();
    }

    
    blitFramebuffer() {
        RenderPass.blitFramebuffer(this.context, ...arguments);
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

    static previous = Symbol('previous pass');
}

export default RenderPass;