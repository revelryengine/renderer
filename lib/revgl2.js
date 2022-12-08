// deno-lint-ignore-file camelcase
// The internal slots in this file are based ont eh WebGPU spec names

import { RevGAL } from './revgal.js';

import { 
    GL,
    BUFFER_USAGE,
    TEXTURE_USAGE,
    TEXTURE_FORMAT,
    FRAMEUBUFFER_STATUS_ERRORS,
    VERTEX_FORMAT,
    PRIMITIVE_MODES,
    SAMPLER_PARAM,
    COMPARE_FUNC,
    CULL_MODE,
    BLEND_OPERATION,
    BLEND_FACTOR,
} from './constants.js';

const CHECK_FRAMEBUFFER_STATUS = false;

/**
 * Since we don't really have internal slots here, we will store everything in a symbol property. 
 * I tried to use private fields but there were too many cases where the internal slots were accessed from other classes.
 */
const _ = Symbol.for('RevGAL');
/**
 * @see https://www.w3.org/TR/webgpu/#gpuobjectbase
 */
class RevGL2ObjectBase {
    [_] = {};
    constructor(device, { label } = {}) {
        this[_].device = device;
        this.label = label || null; 
    }
}

/**
 * @see https://www.w3.org/TR/webgpu/#gpu-device
 */
class RevGL2Device extends RevGL2ObjectBase {
    constructor(context, descriptor) {
        super(null, descriptor);
        const extensions = [
            'EXT_texture_filter_anisotropic',
            'EXT_color_buffer_float',
            'EXT_color_buffer_half_float',
            // 'OES_texture_float_linear', //avoid this if possible

            'KHR_parallel_shader_compile',
            'WEBGL_lose_context',

            'WEBGL_compressed_texture_astc',
            'WEBGL_compressed_texture_etc1',
            'EXT_texture_compression_bptc',
        ];

        const required = [
            // 'EXT_color_buffer_float',
            // 'EXT_color_buffer_half_float',
            // 'OES_texture_float_linear',
        ]

        const glExtensions = {};
        for(const ext of extensions) {
            glExtensions[ext] = context.getExtension(ext);
            if(!glExtensions[ext] && required.indexOf(ext) !== -1) {
                console.warn('WebGL Extension not supported:', ext);
            }
        }
        this[_].context = context;
        this[_].glExtensions = Object.freeze(glExtensions);

        Object.defineProperty(this, 'limits', { value: Object.freeze({
            maxTextureDimension2D           : context.getParameter(GL.MAX_TEXTURE_SIZE),
            maxTextureArrayLayers           : context.getParameter(GL.MAX_ARRAY_TEXTURE_LAYERS),
            maxSamplersPerShaderStage       : context.getParameter(GL.MAX_TEXTURE_IMAGE_UNITS),
            maxUniformBuffersPerShaderStage : context.getParameter(GL.MAX_UNIFORM_BUFFER_BINDINGS),
        }) });

        context.pixelStorei(GL.UNPACK_FLIP_Y_WEBGL, false);
        context.pixelStorei(GL.UNPACK_COLORSPACE_CONVERSION_WEBGL, GL.NONE);
        
        this.queue = new RevGL2Queue(this);

        this.features = new Set();

        if(this[_].glExtensions.WEBGL_compressed_texture_astc) {
            this.features.add('texture-compression-astc');
        }

        if(this[_].glExtensions.WEBGL_compressed_texture_etc) {
            this.features.add('texture-compression-etc2');
        }

        if(this[_].glExtensions.EXT_texture_compression_bptc) {
            this.features.add('texture-compression-bc');
        }

        this[_].configureContext = (...args) => this.#configureContext(...args);
    }

    #configureContext({ size, usage, format }) {
        this[_].contextTexture     = this.createTexture({ size, usage, format });
        this[_].contextFramebuffer = this.#createContextFramebuffer(this[_].contextTexture);
    }

    #createContextFramebuffer(texture) {
        const gl = this[_].context;
        const framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture[_].glTexture, 0);
        return framebuffer;
    }

    destroy(){
        this[_].context.loseContext();
    }

    createBuffer(descriptor) {
        return new RevGL2Buffer(this, descriptor);
    }

    createTexture(descriptor) {
        return new RevGL2Texture(this, descriptor);
    }

    createSampler(descriptor) {
        return new RevGL2Sampler(this, descriptor);
    }

    createBindGroupLayout(descriptor){
        return new RevGL2BindGroupLayout(this, descriptor);
    }

    createPipelineLayout(descriptor) {
        return new RevGL2PipelineLayout(this, descriptor);
    }

    createBindGroup(descriptor) {
        return new RevGL2BindGroup(this, descriptor);
    }

    createRenderPipeline(descriptor) {
        return new RevGL2RenderPipeline(this, descriptor);
    }

    async createRenderPipelineAsync(descriptor) {
        const pipeline = new RevGL2RenderPipeline(this, descriptor, true);
        await pipeline[_].glProgramPromise;
        return pipeline;
    }

    createCommandEncoder(descriptor) {
        return new RevGL2CommandEncoder(this, descriptor);
    }

    createShaderModule(descriptor) {
        return new RevGL2ShaderModule(this, descriptor);
    }
}

/**
 * @see https://www.w3.org/TR/webgpu/#gpuqueue
 */
class RevGL2Queue extends RevGL2ObjectBase {
    submit([commands]) {
        const gl = this[_].device[_].context;
        
        for(const command of commands){
            command();
        }
        const { contextTexture, contextFramebuffer } = this[_].device[_];

        // blitframebuffer to canvas
        const { width, height } = contextTexture[_].descriptor.size;
        
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, contextFramebuffer);
        gl.blitFramebuffer(
            0, 0, width, height,
            0, 0, gl.canvas.width, gl.canvas.height,
            GL.COLOR_BUFFER_BIT, GL.NEAREST
        );

        gl.flush();
    }

    writeBuffer(buffer, bufferOffset, data, dataOffset = 0, size = 0) {
        const gl = this[_].device[_].context;
        
        const { glBuffer, glTarget } = buffer[_];

        gl.bindBuffer(glTarget, glBuffer);
        gl.bufferSubData(glTarget, bufferOffset, data, dataOffset, size);
    }

    writeTexture(destination, data, dataLayout, size) {
        const gl = this[_].device[_].context;

        const { texture, mipLevel = 0, origin = {} } = destination;
        const { glTexture, glTarget, descriptor } = texture[_];

        const { offset = 0  } = dataLayout;
        const { width, height, depthOrArrayLayers = 1 } = size;

        const { webgl2 } = TEXTURE_FORMAT[descriptor.format];

        gl.bindTexture(glTarget, glTexture);

        const { x = 0, y = 0, z = 0 } = origin;

        if(glTarget === GL.TEXTURE_2D_ARRAY || glTarget === GL.TEXTURE_3D) {
            if(webgl2.compressed) {
                gl.compressedTexSubImage3D(glTarget, mipLevel, x, y, z, width, height, depthOrArrayLayers, webgl2.format, data, offset);
            } else {
                gl.texSubImage3D(glTarget, mipLevel, x, y, z, width, height, depthOrArrayLayers, webgl2.format, webgl2.type, data, offset);
            }
            // gl.texImage3D(glTarget, mipLevel, webgl2.internal, width, height, depthOrArrayLayers, 0, webgl2.format, webgl2.type, data, offset);
        } else if(glTarget === GL.TEXTURE_CUBE_MAP) {
            const offsetPerFace = data.length / 6;
            for(let i = 0; i < 6; i++) {
                if(webgl2.compressed) {
                    gl.compressedTexSubImage2D(GL.TEXTURE_CUBE_MAP_POSITIVE_X + i, mipLevel, x, y, width, height, webgl2.format, data, i * offsetPerFace);
                } else {
                    gl.texSubImage2D(GL.TEXTURE_CUBE_MAP_POSITIVE_X + i, mipLevel, x, y, width, height, webgl2.format, webgl2.type, data, i * offsetPerFace);
                }

                // gl.texImage2D(GL.TEXTURE_CUBE_MAP_POSITIVE_X + i, mipLevel, webgl2.internal, width, height, 0, webgl2.format, webgl2.type, data, i * offsetPerFace);
            }
        } else {
            if(webgl2.compressed) {
                gl.compressedTexSubImage2D(glTarget, mipLevel, x, y, width, height, webgl2.format, data, offset);
            } else {
                gl.texSubImage2D(glTarget, mipLevel, x, y, width, height, webgl2.format, webgl2.type, data, offset);
            }
            
            // gl.texImage2D(glTarget, mipLevel, webgl2.internal, width, height, 0, webgl2.format, webgl2.type, data, offset);
        }
    }

    copyExternalImageToTexture({ source }, destination, copySize) {
        const gl = this[_].device[_].context;

        const { texture, mipLevel = 0, origin = {} } = destination;
        const { glTexture, glTarget, descriptor } = texture[_];

        const { format        } = descriptor;
        const { width, height } = copySize;

        const { x = 0, y = 0 } = origin;

        const { webgl2 } = TEXTURE_FORMAT[format];

        gl.bindTexture(glTarget, glTexture);

        gl.texSubImage2D(glTarget, mipLevel, x, y, width, height, webgl2.format, webgl2.type, source);
        // gl.texImage2D(glTarget, mipLevel, webgl2.internal, width, height, 0, webgl2.format, webgl2.type, source);
    }

    async onSubmittedWorkDone() {
        const gl = this[_].device[_].context;

        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);

        gl.flush();

        return await new Promise((resolve, reject) => {
            const check = () => {
                const res = gl.clientWaitSync(sync, 0, 0);
                    if (res == gl.WAIT_FAILED) {
                        reject();
                        return;
                    }
                    if (res == gl.TIMEOUT_EXPIRED) {
                        setTimeout(check, 0);
                        return;
                    }
                    resolve();
            }
            check();
        });
    }
}



/**
 * @see https://www.w3.org/TR/webgpu/#gpuprogrammablepassencoder
 */
class RevGL2ProgrammablePassEncoder extends RevGL2ObjectBase {
    constructor(device, descriptor, commandEncoder) {
        super(device, descriptor);

        this[_].command_encoder = commandEncoder;
        this[_].bind_groups = [];
    }

    setBindGroup(index, bindGroup) {
        this[_].command_encoder[_].command_list.push(() => {
            this[_].bind_groups[index] = bindGroup;
        });
    }
}

/**
 * @see https://www.w3.org/TR/webgpu/#render-pass-encoder
 */
class RevGL2RenderPassEncoder extends RevGL2ProgrammablePassEncoder {
    constructor(device, descriptor, commandEncoder) {
        super(device, descriptor, commandEncoder);
        
        this[_].descriptor = descriptor;

        this[_].pipeline            = null;
        this[_].index_buffer        = null;
        this[_].index_format        = null;
        this[_].index_offset        = null;
        this[_].index_buffer_size   = null;

        this[_].vertex_buffers        = [];
        this[_].vertex_buffer_sizes   = [];
        this[_].vertex_buffer_offsets = [];

        this[_].attachment_size = this.#getAttachmentSize(descriptor);
        
        this[_].viewport        = { ...this[_].attachment_size, x: 0, y: 0, minDepth: 0, maxDepth: 1 };

        this[_].glFramebuffer   = this.#createFramebuffer(descriptor);
        this[_].glRenderbuffers = this.#createRenderbuffers(descriptor);
        
        device[_].context.disable(GL.DEPTH_TEST);
        device[_].context.disable(GL.SCISSOR_TEST);
    }

    #getAttachmentSize(descriptor) {
        const { colorAttachments, depthStencilAttachment } = descriptor;

        if(depthStencilAttachment) {
            const { width, height } = depthStencilAttachment.view[_].renderExtent;
            return { width, height };
        }

        for(const attachment of colorAttachments){
            const { width, height } = attachment.view[_].renderExtent;
            return { width, height };
        }
    }

    #createFramebuffer(descriptor) { 
        const gl = this[_].device[_].context;

        const framebuffer = gl.createFramebuffer();

        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

        const { colorAttachments, depthStencilAttachment } = descriptor;

        gl.drawBuffers(colorAttachments.map((_, i) => gl.COLOR_ATTACHMENT0 + i));

        for(let i = 0; i < colorAttachments.length; i++) {
            const { view, clearValue, loadOp                  } = colorAttachments[i];
            const { texture, descriptor                       } = view[_];
            const { glTexture, glTarget, descriptor: { size } } = texture[_];
            
            if(glTarget === gl.TEXTURE_CUBE_MAP) {
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_CUBE_MAP_POSITIVE_X + descriptor.baseArrayLayer, glTexture, descriptor.baseMipLevel);
            } else if(size.depthOrArrayLayers > 1) {
                gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, glTexture, descriptor.baseMipLevel, descriptor.baseArrayLayer);
            } else {
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, glTexture, descriptor.baseMipLevel);
            }
            
            if(loadOp !== 'load') gl.clearBufferfv(gl.COLOR, i, clearValue);
        }

        if(depthStencilAttachment) {
            const { view, depthLoadOp, depthClearValue, stencilLoadOp, stencilClearValue } = depthStencilAttachment;
            const { texture, descriptor             } = view[_];
            const { glTexture, descriptor: { size } } = texture[_];

            const attachment = descriptor.format.includes('stencil') ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT;
            if(size.depthOrArrayLayers > 1) {
                gl.framebufferTextureLayer(gl.FRAMEBUFFER, attachment, glTexture, descriptor.baseMipLevel, descriptor.baseArrayLayer);
            } else {
                gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, glTexture, descriptor.baseMipLevel);
            }
            
            if(depthLoadOp !== 'load' && stencilLoadOp !== 'load') gl.clearBufferfi(gl.DEPTH_STENCIL, 0, depthClearValue, stencilClearValue);
        }

        if(CHECK_FRAMEBUFFER_STATUS) {
            const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
            if(status != gl.FRAMEBUFFER_COMPLETE){
                throw new Error(`Framebuffer error: ${FRAMEUBUFFER_STATUS_ERRORS[status]}`);
            }
        }

        return framebuffer;
    }

    #createRenderbuffers({ colorAttachments = [], depthStencilAttachment }) {
        const gl = this[_].device[_].context;
        const { sampleCount   } = (colorAttachments[0] || depthStencilAttachment).view[_].texture[_].descriptor;

        const renderbuffers = [];

        if(sampleCount > 1) {
            const { glFramebuffer, attachment_size } = this[_];
            const { width, height } = attachment_size;
            
            gl.bindFramebuffer(gl.FRAMEBUFFER, glFramebuffer);
            
            for(let i = 0; i < colorAttachments.length; i++) {
                const { view, resolveTarget } = colorAttachments[i];
                const { descriptor } = view[_];

                const { webgl2 } = TEXTURE_FORMAT[descriptor.format];
                const attachment = gl.COLOR_ATTACHMENT0 + i;

                const glRenderbuffer = gl.createRenderbuffer();
                
                gl.bindRenderbuffer(gl.RENDERBUFFER, glRenderbuffer);
                gl.renderbufferStorageMultisample(gl.RENDERBUFFER, sampleCount, webgl2.internal, width, height);
                gl.framebufferRenderbuffer(gl.FRAMEBUFFER, attachment, gl.RENDERBUFFER, glRenderbuffer);
                
                renderbuffers.push({ attachment, resolveTarget, glRenderbuffer });
            }

            if(depthStencilAttachment) {
                const { view, glResolveTarget } = depthStencilAttachment;
                const { descriptor } = view[_];

                const { webgl2 } = TEXTURE_FORMAT[descriptor.format];
                const attachment = descriptor.format.includes('stencil') ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT;

                const glRenderbuffer = gl.createRenderbuffer();
                gl.bindRenderbuffer(gl.RENDERBUFFER, glRenderbuffer);
                gl.renderbufferStorageMultisample(gl.RENDERBUFFER, sampleCount, webgl2.internal, width, height);
                gl.framebufferRenderbuffer(gl.FRAMEBUFFER, attachment, gl.RENDERBUFFER, glRenderbuffer);

                renderbuffers.push({ attachment, resolveTarget: glResolveTarget, glRenderbuffer });
            }

            if(CHECK_FRAMEBUFFER_STATUS) {
                const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
                if(status != gl.FRAMEBUFFER_COMPLETE){
                    throw new Error(`Renderbuffer error: ${FRAMEUBUFFER_STATUS_ERRORS[status]}`);
                }
            }
        }
        
        return renderbuffers;
    }

    #resolveRenderbuffers() {
        const gl = this[_].device[_].context;

        const { glFramebuffer, glRenderbuffers, attachment_size } = this[_];
        const { width, height } = attachment_size;
        
        const drawFramebuffer = gl.createFramebuffer();
        const colorAttachments = [];

        gl.bindFramebuffer(gl.FRAMEBUFFER, drawFramebuffer);
        for(const { resolveTarget, attachment } of glRenderbuffers){
            const { texture, descriptor } = resolveTarget[_];
            const { glTexture } = texture[_];
            gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, glTexture, descriptor.baseMipLevel);
            if(attachment !== gl.DEPTH_STENCIL_ATTACHMENT && attachment !==  gl.DEPTH_ATTACHMENT) colorAttachments.push(attachment);
        }
            
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, glFramebuffer);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, drawFramebuffer);


        gl.blitFramebuffer(
            0, 0, width, height,
            0, 0, width, height,
            GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT | GL.STENCIL_BUFFER_BIT, GL.NEAREST
        );

        /**
         * blit additional color attachments
         * @see https://registry.khronos.org/OpenGL/extensions/EXT/EXT_framebuffer_blit.txt (Issue 12)
         */
        if(colorAttachments.length > 1) {
            for(let i = 1; i < colorAttachments.length; i++) {
                const buffers = colorAttachments.map((attachment, j) => i === j ? attachment : gl.NONE);
                gl.drawBuffers(buffers)
                gl.readBuffer(buffers[i]);

                gl.blitFramebuffer(
                    0, 0, width, height,
                    0, 0, width, height,
                    GL.COLOR_BUFFER_BIT, GL.NEAREST
                );
            }
        }

        for(const { glRenderbuffer } of glRenderbuffers){
            gl.deleteRenderbuffer(glRenderbuffer);
        }
    }

    setPipeline(pipeline) {    
        this[_].command_encoder[_].command_list.push(() => {
            this[_].pipeline = pipeline;
        });
    }

    setVertexBuffer(slot, buffer, offset = 0, size) {
        size = size || Math.max(0, buffer[_].size - offset);
        this[_].command_encoder[_].command_list.push(() => {
            this[_].vertex_buffers[slot]        = buffer;
            this[_].vertex_buffer_sizes[slot]   = size;
            this[_].vertex_buffer_offsets[slot] = offset;
        });
    }

    setIndexBuffer(buffer, indexFormat, offset, size) {
        size = size || Math.max(0, buffer[_].size - offset);
        this[_].command_encoder[_].command_list.push(() => {
            this[_].index_buffer      = buffer;
            this[_].index_format      = indexFormat;
            this[_].index_offset      = offset;
            this[_].index_buffer_size = size;
        });
    }

    setViewport(x, y, width, height, minDepth, maxDepth) {
        this[_].command_encoder[_].command_list.push(() => {
            Object.assign(this[_].viewport, { x, y, width, height, minDepth, maxDepth });
        });
    }

    setScissorRect(x, y, width, height) {
        const gl = this[_].device[_].context;
        this[_].command_encoder[_].command_list.push(() => {
            gl.enable(gl.SCISSOR_TEST);
            gl.scissor(x, y, width, height);
        });
    }

    #textureSlots = [];
    setBindGroup(index, bindGroup) {
        this[_].command_encoder[_].command_list.push(() => {
            if(this[_].bind_groups[index] != bindGroup) {
                this.#textureSlots[index] = [];

                let uniformSlot = 0;
                let textureSlot = 0;

                for(let i = 0; i < index; i++) {
                    uniformSlot += this[_].bind_groups[i][_].layout[_].glUniformSlotCount;
                    textureSlot += this[_].bind_groups[i][_].layout[_].glTextureSlotCount;
                }

                const gl       = this[_].device[_].context;
                const entryMap = bindGroup[_].layout[_].entryMap;

                for(const { binding, resource } of bindGroup[_].entries) {
                    const { buffer, texture } = entryMap[binding]; 
                    if(buffer) {
                        gl.bindBufferBase(gl.UNIFORM_BUFFER, uniformSlot++, resource.buffer[_].glBuffer);
                    } else if(texture) {
                        const slot = textureSlot++;
                        const { glTexture, glTarget } = resource[_].texture[_];
                        gl.activeTexture(gl.TEXTURE0 + slot);
                        gl.bindTexture(glTarget, glTexture);
                        this.#textureSlots[index][binding] = slot;
                    }
                }
            }

            this[_].bind_groups[index] = bindGroup;
        });
    }

    #bindSamplers() {
        const gl = this[_].device[_].context;

        const { glSamplerBindings } = this[_].pipeline[_];
        
        const bindGroups = this[_].bind_groups;

        for(const { group, texture, sampler } of glSamplerBindings) {
            const slot = this.#textureSlots[group][texture];

            if(sampler !== undefined) {
                const { glSampler } = bindGroups[group][_].entries[sampler].resource[_];
                gl.bindSampler(slot, glSampler);
            } else { 
                gl.bindSampler(slot, null);
            }
            
        }
    }

    static #pipelineVAO = new WeakMap();
    #setVertexArrays(firstInstance = 0, baseVertex = 0) {
        const gl = this[_].device[_].context;

        const { pipeline   } = this[_];
        const { descriptor } = pipeline[_];

        if(!descriptor.vertex?.buffers?.length) {
            gl.disableVertexAttribArray(0);
        }

        for(const { arrayStride, attributes, stepMode } of descriptor.vertex.buffers || []) {
            for(const attribute of attributes) {
                const { shaderLocation: slot, format } = attribute;
                const buffer = this[_].vertex_buffers[slot];
                const offset = this[_].vertex_buffer_offsets[slot];

                gl.bindBuffer(gl.ARRAY_BUFFER, buffer[_].glBuffer);
                gl.enableVertexAttribArray(slot);
                
                const { webgl2 } = VERTEX_FORMAT[format]
                const { normalized, type, integer, size } = webgl2;
                
                let vertOffset = offset;
                if(stepMode === 'instance'){
                    gl.vertexAttribDivisor(slot, 1);
                    vertOffset += firstInstance * arrayStride;
                } else {
                    vertOffset += baseVertex;
                }

                if(integer) {
                    gl.vertexAttribIPointer(slot, size, type, arrayStride, vertOffset);
                } else {
                    gl.vertexAttribPointer(slot, size, type, normalized, arrayStride, vertOffset);
                }
            }
        }
        
        // let vao = RevGL2RenderPassEncoder.#pipelineVAO.get(pipeline);
        // if(vao) {
        //     gl.bindVertexArray(vao);
        // } else {
        //     vao = gl.createVertexArray();
        //     gl.bindVertexArray(vao);

        //     // put vertex object stuff here 

        //     RevGL2RenderPassEncoder.#pipelineVAO.set(pipeline, vao);
        // }
    }

    #startDraw(){
        const gl = this[_].device[_].context;
        const { viewport, pipeline, glFramebuffer } = this[_];

        const { x, y, width, height } = viewport;
        const { descriptor, writesDepth, glProgram, glDrawBuffers } = pipeline[_];
            
        gl.viewport(x, y, width, height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, glFramebuffer);

        gl.drawBuffers(glDrawBuffers);

        const cullMode = descriptor.primitive?.cullMode;
        if(cullMode && cullMode !== 'none') {
            gl.enable(GL.CULL_FACE);
            gl.cullFace(CULL_MODE[cullMode]);
        } else {
            gl.disable(GL.CULL_FACE);
        }

        const blend = descriptor.fragment.targets[0]?.blend;
        if(blend) {
            gl.enable(GL.BLEND);
            gl.blendFuncSeparate(
                BLEND_FACTOR[blend.color?.srcFactor] || GL.ONE,
                BLEND_FACTOR[blend.color?.dstFactor] || GL.ZERO,
                BLEND_FACTOR[blend.alpha?.srcFactor] || GL.ONE,
                BLEND_FACTOR[blend.alpha?.dstFactor] || GL.ZERO,
            )
            gl.blendEquationSeparate(
                BLEND_OPERATION[blend.color?.operation] || GL.FUNC_ADD,
                BLEND_OPERATION[blend.alpha?.operation] || GL.FUNC_ADD,
                );
        } else {
            gl.disable(GL.BLEND);
        }

        if(descriptor.depthStencil) {
            gl.depthMask(writesDepth);
            gl.enable(GL.DEPTH_TEST);
            gl.depthFunc(COMPARE_FUNC[descriptor.depthStencil.depthCompare || 'always']);

            if(descriptor.depthStencil.depthBias) {
                const { depthBias = 0, depthBiasSlopeScale = 0 } = descriptor.depthStencil;
                // opengl offset = factor * DZ + r * units
                // webgpu offset = state.depthBiasSlopeScale * maxDepthSlope + r * state.depthBias
                gl.enable(GL.POLYGON_OFFSET_FILL);
                gl.polygonOffset(depthBiasSlopeScale, depthBias);
            } else {
                gl.disable(GL.POLYGON_OFFSET_FILL);
            }

        } else {
            gl.depthMask(true);
            gl.disable(GL.DEPTH_TEST);
            gl.disable(GL.POLYGON_OFFSET_FILL);
        }

        gl.useProgram(glProgram);
    }

    draw(vertexCount, instanceCount, firstVertex, firstInstance) {
        const gl = this[_].device[_].context;
        this[_].command_encoder[_].command_list.push(() => {
            this.#startDraw();

            this.#bindSamplers();
            this.#setVertexArrays(firstInstance);

            const mode = PRIMITIVE_MODES[this[_].pipeline[_].descriptor.primitive?.topology || 'triangle-list'];
            if(instanceCount > 1) {
                gl.drawArraysInstanced(mode, firstVertex, vertexCount, instanceCount);
            } else {
                gl.drawArrays(mode, firstVertex, vertexCount);
            }
        });
    }

    drawIndexed(indexCount, instanceCount, firstIndex, baseVertex, firstInstance) {
        const gl = this[_].device[_].context;

        this[_].command_encoder[_].command_list.push(() => {       
            this.#startDraw();

            const indexBuffer = this[_].index_buffer;
            const indexOffset = this[_].index_offset;
            const indexFormat = this[_].index_format;
            
            this.#bindSamplers();
            this.#setVertexArrays(firstInstance, baseVertex, indexBuffer[_].glBuffer);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer[_].glBuffer);

            const mode = PRIMITIVE_MODES[this[_].pipeline[_].descriptor.primitive?.topology || 'triangle-list'];
            if(instanceCount > 1) {
                gl.drawElementsInstanced(mode, indexCount, VERTEX_FORMAT[indexFormat].webgl2.type, indexOffset + firstIndex, instanceCount);
            } else {
                gl.drawElements(mode, indexCount, VERTEX_FORMAT[indexFormat].webgl2.type, indexOffset + firstIndex);
            }
        });
    }

    end() {
        const gl = this[_].device[_].context;

        if(this[_].glRenderbuffers.length){
            this[_].command_encoder[_].command_list.push(() => {
                this.#resolveRenderbuffers();
            });
        }

        this[_].command_encoder[_].command_list.push(() => {
            gl.deleteFramebuffer(this[_].glFramebuffer);
        });
    }
}

/**
 * @see https://www.w3.org/TR/webgpu/#render-pipeline
 */
class RevGL2RenderPipeline extends RevGL2ObjectBase {
    constructor(device, descriptor, async) {
        super(device, descriptor);

        this[_].descriptor    = descriptor;
        this[_].writesDepth   = descriptor.depthStencil?.depthWriteEnabled;
        this[_].glDrawBuffers = descriptor.fragment.targets.map(({ writeMask = 0xF }, i) => writeMask && GL.COLOR_ATTACHMENT0 + i);

        if(async) {
            this[_].glProgramPromise = this.#getProgramAsync(descriptor);
        } else {
            this.#getProgram(descriptor);
        }
        
    }

    static #programCache = new WeakMap();

    static getProgramFromCache(vertex, fragment) {
        let vertCache = this.#programCache.get(vertex) || this.#programCache.set(vertex, new WeakMap()).get(vertex);
        return vertCache.get(fragment);
    }

    static addProgramToCache(vertex, fragment, program) {
        this.#programCache.get(vertex).set(fragment, program);
        return program;
    }
    
    async #getProgramAsync(descriptor) {
        const { vertex, fragment } = descriptor;

        const program = await (
            RevGL2RenderPipeline.getProgramFromCache(vertex.module, fragment.module) || 
            RevGL2RenderPipeline.addProgramToCache(vertex.module, fragment.module, this.#compileProgramAsync(vertex, fragment))
        );

        this[_].glProgram = program;
        this.#setBindingUniforms(program, descriptor);

        return program;
    }

    async #compileProgramAsync(vertex, fragment) {
        const gl = this[_].device[_].context;

        const program = gl.createProgram();

        gl.attachShader(program, vertex.module[_].glShader);
        gl.attachShader(program, fragment.module[_].glShader);
        gl.linkProgram(program);
        
        const ext = gl.getExtension('KHR_parallel_shader_compile');
        if (ext) {
            do {
                await new Promise(resolve => setTimeout(resolve));
            } while(!gl.getProgramParameter(program, ext.COMPLETION_STATUS_KHR))
        }

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const log = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            console.warn('Failed to create program', log);
            throw new Error(`Error linking program: ${log}`);
        }

        return program;
    }

    #getProgram(descriptor) {
        const { vertex, fragment } = descriptor;

        const program = (
            RevGL2RenderPipeline.getProgramFromCache(vertex.module, fragment.module) || 
            RevGL2RenderPipeline.addProgramToCache(vertex.module, fragment.module, this.#compileProgram(vertex, fragment))
        );

        this[_].glProgram = program;
        this.#setBindingUniforms(program, descriptor);

        return program;
    }

    #compileProgram(vertex, fragment) {
        const gl = this[_].device[_].context;
        const program = gl.createProgram();

        gl.attachShader(program, vertex.module[_].glShader);
        gl.attachShader(program, fragment.module[_].glShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const log = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            console.warn('Failed to create program', log);
            throw new Error(`Error linking program: ${log}`);
        }
        return program;
    }

    #getBindingSlots(layout) {
        const bindingSlots = [];

        const { bindGroupLayouts } = layout[_].descriptor;

        let textureSlot = 0, uniformSlot = 0;
        for(let g = 0; g < bindGroupLayouts.length; g++) {
            bindingSlots[g] = [];
            for(let b = 0; b < bindGroupLayouts[g][_].entryMap.length; b++) {
                const { texture, buffer } = bindGroupLayouts[g][_].entryMap[b];

                if(buffer !== undefined) {
                    bindingSlots[g][b] = uniformSlot++;
                } 

                if(texture !== undefined) {
                    bindingSlots[g][b] = textureSlot++;
                } 
            }
        }

        return bindingSlots;
    }

    #setBindingUniforms(program, { layout, fragment, vertex }) {
        const gl = this[_].device[_].context;
        
        const bindingSlots = this.#getBindingSlots(layout)

        gl.useProgram(program);

        const vertSrc = gl.getShaderSource(vertex.module[_].glShader);
        const fragSrc = gl.getShaderSource(fragment.module[_].glShader);
        const source = vertSrc + fragSrc;

        const blocks = {};
        for (let i = 0, l = gl.getProgramParameter(program, gl.ACTIVE_UNIFORM_BLOCKS); i < l; i++) {
            const name = gl.getActiveUniformBlockName(program, i);
            blocks[name] = i;
        }

        let match;
        while((match = RevGL2RenderPipeline.UNIFORM_BINDING_REGEX.exec(source))) {
            const [,name, group, binding] = match;
            const location = blocks[name];
            if(location !== undefined) {
                const slot = bindingSlots[group][binding];
                gl.uniformBlockBinding(program, location, slot);
            }
        }

        /**
         * We will need to store the sampler bindings from the shader because we will need to bind them 
         * at draw time since WebGL2 binds samplers to texture slots. 
         * We won't be able to bind them here, since we need the sampler resource.
         */
        const samplerBindings = [];
        while((match = RevGL2RenderPipeline.TEXTURE_BINDING_REGEX.exec(source))) {
            const [,name, group, binding, sampler] = match;
            const location = gl.getUniformLocation(program, name);
            if(location !== null) {
                const slot = bindingSlots[group][binding];
                gl.uniform1i(location, slot);

                samplerBindings.push({ group: Number(group), texture: Number(binding), sampler: sampler && Number(sampler) });
            }

        }

        this[_].glSamplerBindings = samplerBindings;
    }

    static UNIFORM_BINDING_REGEX = /#pragma revUniformBinding\((\w+),\s+?(\d+),\s+?(\d+)\)/g;
    static TEXTURE_BINDING_REGEX = /#pragma revTextureBinding\((\w+),\s+?(\d+),\s+?(\d+)(?:,\s+?(\d+))?\)/g;
}

/**
 * @see https://www.w3.org/TR/webgpu/#command-encoder
 */
class RevGL2CommandEncoder extends RevGL2ObjectBase {
    constructor(device, descriptor) {
        super(device, descriptor);
        this[_].command_list = [];
    }

    beginRenderPass(descriptor) {
        return new RevGL2RenderPassEncoder(this[_].device, descriptor, this);
    }

    copyTextureToTexture(src, dst, size) {
        this[_].command_list.push(() => {
            const gl = this[_].device[_].context;

            const { mipLevel: srcMipLevel = 0 } = src;
            const { mipLevel: dstMipLevel = 0 } = dst;

            const { srcX = 0, srcY = 0, srcZ = 0 } = src.origin || {};
            const { dstX = 0, dstY = 0, dstZ = 0 } = dst.origin || {};

            const { glTexture: srcTexture, glTarget: srcTarget } = src.texture[_];
            const { glTexture: dstTexture, glTarget: dstTarget } = dst.texture[_];

            const { width, height, depthOrArrayLayers = 1 } = size;

            const framebuffer = gl.createFramebuffer();

            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

            gl.readBuffer(gl.COLOR_ATTACHMENT0);

            gl.bindTexture(dstTarget, dstTexture);

            if(srcTarget === gl.TEXTURE_2D_ARRAY || srcTarget === gl.TEXTURE_3D) {
                for(let i = 0; i < depthOrArrayLayers; i++){
                    gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, srcTexture, srcMipLevel, srcZ + i);
                    gl.copyTexSubImage3D(dstTarget, dstMipLevel, dstX, dstY, dstZ + i, srcX, srcY, width, height);
                }
            } else if(srcTarget === gl.TEXTURE_CUBE_MAP) {
                for(let i = 0; i < depthOrArrayLayers; i++){
                    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + srcZ + i, srcTexture, srcMipLevel);
                    gl.copyTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + dstZ + i, dstMipLevel, dstX, dstY, srcX, srcY, width, height);
                }

            } else {
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, srcTarget, srcTexture, srcMipLevel);
                gl.copyTexSubImage2D(dstTarget, dstMipLevel, dstX, dstY, srcX, srcY, width, height);
            }
        })
    }

    finish(){
        return this[_].command_list;
    }
}

/**
 * @see https://www.w3.org/TR/webgpu/#buffer-interface
 * 
 */
class RevGL2Buffer extends RevGL2ObjectBase {
    constructor(device, descriptor) {
        super(device, descriptor);

        const { size, usage, mappedAtCreation } = descriptor;

        const gl = this[_].device[_].context;

        const target = this.#getTarget(usage);
        const buffer = gl.createBuffer();

        gl.bindBuffer(target, buffer);
        gl.bufferData(target, size, this.#getUsagePattern(usage));
        
        this[_].size     = size;
        this[_].usage    = usage;

        this[_].glTarget = target;
        this[_].glBuffer = buffer;

        this[_].state = mappedAtCreation ? 'mapped at creation' : 'unmapped';

        if(mappedAtCreation) {
            this[_].mapping = new ArrayBuffer(size);
        }
    }

    #getUsagePattern(usage) {
        if(usage & (BUFFER_USAGE.INDEX | BUFFER_USAGE.UNIFORM)) {
            return GL.DYNAMIC_DRAW;
        }

        return GL.STATIC_DRAW;
    }


    #getTarget(usage) {
        if(usage & BUFFER_USAGE.VERTEX) {
            return GL.ARRAY_BUFFER;
        }
        if(usage & BUFFER_USAGE.INDEX) {
            return GL.ELEMENT_ARRAY_BUFFER;
        }
        if(usage & BUFFER_USAGE.UNIFORM) {
            return GL.UNIFORM_BUFFER;
        }

        return GL.ARRAY_BUFFER;
    }

    /**
     * Mapped ranges that are not the full range are unsupported because there is no way to efficiently do this until Resizable ArrayBuffers are available
     * @see https://github.com/tc39/proposal-resizablearraybuffer
     */
    getMappedRange(offset = 0, size) {
        const { state } = this[_];
        const rangeSize = size || Math.max(0, this[_].size - offset);

        if(offset !== 0 || rangeSize !== this[_].size) {
            throw new Error('Full range required for RevGL2');
        }
        if(!['mapped', 'mapped at creation'].includes(state)) {
            throw new Error('Buffer not in mapped state');
        }

        return this[_].mapping;
    }

    unmap() {
        const { glBuffer, glTarget, state } = this[_];

        if(!['mapped', 'mapped at creation'].includes(state)) {
            throw new Error('Buffer not in mapped state');
        }
        const gl = this[_].device[_].context;
        
        gl.bindBuffer(glTarget, glBuffer);
        gl.bufferSubData(glTarget, 0, this[_].mapping);

        this[_].mapping = null;
        this[_].state = 'unmapped';
    }

    // deno-lint-ignore require-await
    async mapAsync() {
        throw new Error('mapAsync not implemented yet in RevGL2');
    }
    
    destroy() {
        this[_].device[_].context.deleteBuffer(this[_].glBuffer);
    }
}

/**
 * @see https://www.w3.org/TR/webgpu/#gpu-textureview
 */
export class RevGL2TextureView extends RevGL2ObjectBase {
    constructor(device, descriptor, texture) {
        descriptor = RevGL2TextureView.#resolveDefaultViewDescriptor(texture, descriptor);
        
        super(device, descriptor);

        this[_].texture    = texture;
        this[_].descriptor = descriptor;

        if(this[_].texture[_].descriptor.usage & TEXTURE_USAGE.RENDER_ATTACHMENT) {
            this[_].renderExtent = this.#computeRenderExtent(texture[_].descriptor.size, descriptor.baseMipLevel || 0);
        } 
    }

    /** @see https://www.w3.org/TR/webgpu/#texture-view-creation */
    static #resolveDefaultViewDescriptor(texture, { format, dimension, aspect = 'all', baseMipLevel = 0, mipLevelCount, baseArrayLayer = 0, arrayLayerCount } = {}) {
        const { descriptor } = texture[_];

        const resolved = { format, dimension, aspect, baseMipLevel, mipLevelCount, baseArrayLayer, arrayLayerCount };
        resolved.format = resolved.format || descriptor.format;
        resolved.mipLevelCount = resolved.mipLevelCount || descriptor.mipLevelCount - baseMipLevel;

        if(!resolved.dimension) {
            if(descriptor.dimension === '1d') resolved.dimension = '1d';
            if(descriptor.dimension === '2d') resolved.dimension = '2d';
            if(descriptor.dimension === '3d') resolved.dimension = '3d';
        }

        if(resolved.arrayLayerCount === undefined) {
            if(['1d', '2d', '3d'].includes(resolved.dimension)) resolved.arrayLayerCount = 1;
            if(resolved.dimension === 'cube') resolved.arrayLayerCount = 6;
            if(['2d-array', 'cube-array'].includes(resolved.dimension)) {
                resolved.arrayLayerCount = descriptor.size.depthOrArrayLayers - baseArrayLayer;
            }
        }
        return resolved;
    }

    #computeRenderExtent(size, baseMipLevel) {
        return {
            width: Math.max(1, size.width >> baseMipLevel),
            height: Math.max(1, size.height >> baseMipLevel),
            depthOrArrayLayers: 1
        }
    }
}

/**
 * @see https://www.w3.org/TR/webgpu/#texture-interface
 */
class RevGL2Texture extends RevGL2ObjectBase {
    constructor(device, descriptor) {
        super(device, descriptor);

        const { size, format, usage, mipLevelCount = 1, sampleCount = 1, dimension = '2d', array = false, cubemap = false } = descriptor;
        this[_].descriptor = { size, format, usage, mipLevelCount, sampleCount, dimension };
        
        const target = this.#getTarget(dimension, size, array, cubemap);

        this[_].glTarget  = target;
        this[_].glTexture = this.#createTexture({ target, size, format, mipLevelCount });
    }

    #getTarget(dimension, size, array, cubemap) {
        if(dimension === '3d') {
            return GL.TEXTURE_3D;
        } else if(array || cubemap || size.depthOrArrayLayers > 1) {
            if(cubemap) {
                return GL.TEXTURE_CUBE_MAP;
            }
            return GL.TEXTURE_2D_ARRAY;
        }
        return GL.TEXTURE_2D;
    }

    #createTexture({ target, size, format, mipLevelCount = 1 }) {
        const gl = this[_].device[_].context;

        const { width, height, depthOrArrayLayers = 1 } = size;
        const { webgl2 } = TEXTURE_FORMAT[format];

        const texture = gl.createTexture();
        gl.bindTexture(target, texture);

        /**
         * The texImage2D and texImage3D calls are unnessary but useful for debugging with spectorjs
         */
        if(target === GL.TEXTURE_2D_ARRAY || target === GL.TEXTURE_3D) {  
            if(!webgl2.compressed) gl.texImage3D(target, 0, webgl2.internal, width, height, depthOrArrayLayers, 0, webgl2.format, webgl2.type, null);
            gl.texStorage3D(target, mipLevelCount, webgl2.internal, width, height, depthOrArrayLayers);
            
        } else if(target === GL.TEXTURE_CUBE_MAP) {
            if(!webgl2.compressed) {
                for(let i = 0; i < 6; i++) {
                    gl.texImage2D(GL.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, webgl2.internal, width, height, 0, webgl2.format, webgl2.type, null);
                }
            }
            gl.texStorage2D(target, mipLevelCount, webgl2.internal, width, height);
        } else {
            if(!webgl2.compressed) gl.texImage2D(target, 0, webgl2.internal, width, height, 0, webgl2.format, webgl2.type, null);
            gl.texStorage2D(target, mipLevelCount, webgl2.internal, width, height);
        }

        /** We need to default textures themselves to filterless for TBOs. Explicit samplers can be used if other sampling is needed. */
        gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(target, gl.TEXTURE_WRAP_R, gl.REPEAT);

        gl.texParameterf(target, gl.TEXTURE_MAX_LOD,    mipLevelCount);
        gl.texParameteri(target, gl.TEXTURE_MAX_LEVEL,  mipLevelCount);

        return texture
    }

    

    createView(descriptor){
        return new RevGL2TextureView(this.device, descriptor, this);
    }

    destroy() {
        this[_].device[_].context.deleteTexture(this[_].glTexture);
    }
}

/**
 * @see https://www.w3.org/TR/webgpu/#sampler-interface
 */
class RevGL2Sampler extends RevGL2ObjectBase {
    constructor(device, descriptor = {}) {
        super(device, descriptor);

        this[_].descriptor = descriptor;
        this[_].glSampler  = this.#createSampler(descriptor);
    }

    #createSampler(descriptor) {
        const gl = this[_].device[_].context;

        const { 
            minFilter    = 'nearest', 
            magFilter    = 'nearest', 
            addressModeU = 'clamp-to-edge', 
            addressModeV = 'clamp-to-edge', 
            addressModeW = 'clamp-to-edge',
            lodMinClamp  = 0,
            lodMaxClamp  = 32,
            mipmapFilter = 'nearest',
            compare,
            maxAnisotropy = 1,
        } = descriptor;

        const sampler = gl.createSampler();

        gl.samplerParameteri(sampler, GL.TEXTURE_MIN_FILTER, mipmapFilter ? SAMPLER_PARAM.mipmap[minFilter][mipmapFilter] : SAMPLER_PARAM[minFilter]);
        gl.samplerParameteri(sampler, GL.TEXTURE_MAG_FILTER, SAMPLER_PARAM[magFilter]);
        gl.samplerParameteri(sampler, GL.TEXTURE_WRAP_S, SAMPLER_PARAM[addressModeU]);
        gl.samplerParameteri(sampler, GL.TEXTURE_WRAP_T, SAMPLER_PARAM[addressModeV]);
        gl.samplerParameteri(sampler, GL.TEXTURE_WRAP_R, SAMPLER_PARAM[addressModeW]);
        gl.samplerParameterf(sampler, GL.TEXTURE_MIN_LOD, lodMinClamp);
        gl.samplerParameterf(sampler, GL.TEXTURE_MAX_LOD, lodMaxClamp);

        if(compare) {
            gl.samplerParameteri(sampler, GL.TEXTURE_COMPARE_FUNC, COMPARE_FUNC[compare]);
            gl.samplerParameteri(sampler, GL.TEXTURE_COMPARE_MODE, GL.COMPARE_REF_TO_TEXTURE);
        }

        const ext = this[_].device[_].glExtensions.EXT_texture_filter_anisotropic;
        if (ext){
            gl.samplerParameterf(sampler, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(maxAnisotropy, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
        }

        return sampler;
    }
    destroy() {
        this.device[_].context.deleteSampler(this[_].sampler);
    }
}

/**
 * @see https://www.w3.org/TR/webgpu/#gpu-bind-group
 */
class RevGL2BindGroup extends RevGL2ObjectBase {
    constructor(device, descriptor) {
        super(device, descriptor);

        const { layout, entries } = descriptor;

        this[_].layout  = layout;
        this[_].entries = entries;
    }
}

/**
 * @see https://www.w3.org/TR/webgpu/#bind-group-layout
 */
class RevGL2BindGroupLayout extends RevGL2ObjectBase {
    constructor(device, descriptor) {
        super(device, descriptor);
        
        const entryMap = [];
        for(const entry of descriptor.entries) {
            entryMap[entry.binding] = entry;
        }
        this[_].descriptor = descriptor;
        this[_].entryMap   = entryMap;

        this.#getSlotCounts();
    }

    #getSlotCounts() {
        this[_].glUniformSlotCount = 0;
        this[_].glTextureSlotCount = 0;

        for(const entry of this[_].entryMap) {
            const { texture, buffer } = entry;

            if(buffer !== undefined) {
                this[_].glUniformSlotCount++;
            } 

            if(texture !== undefined) {
                this[_].glTextureSlotCount++;
            } 
        }
    }
}

class RevGL2PipelineLayout extends RevGL2ObjectBase {
    constructor(device, descriptor) {
        super(device, descriptor);
        this[_].descriptor = descriptor;
    }
}

let shaderId = 0;
class RevGL2ShaderModule extends RevGL2ObjectBase {
    constructor(device, { glType, ...descriptor }) {
        super(device, descriptor);
        this.id = shaderId++;
        this[_].glShader = device[_].context.createShader(glType);
        device[_].context.shaderSource(this[_].glShader, descriptor.code + `\n//* ${descriptor.label} *//`);
        device[_].context.compileShader(this[_].glShader);
    }

    async compilationInfo() {
        await new Promise(resolve => setTimeout(resolve));

        const gl  = this[_].device[_].context;
        
        if (!gl.getShaderParameter(this[_].glShader, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(this[_].glShader);
            const src = gl.getShaderSource(this[_].glShader);
            const [,linePos, lineNum, message] = log.match(/ERROR: (\d+):(\d+):(.*)/); 
            return { messages: [{ type: 'error', linePos, lineNum, message, src }] };
        }
        return { messages: [] };
    }
}

export class RevGL2 extends RevGAL {
    get api()      { return 'webgl2'; }
    get language() { return 'glsl';   }
    get ndcZO()    { return false;    }

    constructor(target, settings) {
        let context;

        if(target instanceof WebGL2RenderingContext) {
            context = target;
        } else if(target instanceof HTMLCanvasElement) {
            context = target.getContext('webgl2', { antialias: false });
            if(!context) throw new Error('Failed to get context: Make sure that WebGL2 is supported');
        } else {
            throw new Error('Invalid target');
        }

        super(context, settings, new RevGL2Device(context), 'rgba8unorm');
    }

    resize({ width, height }){
        this.device[_].configureContext({
            device: this.device,
            format: this.presentationFormat,
            usage:  TEXTURE_USAGE.RENDER_ATTACHMENT | TEXTURE_USAGE.OUTPUT_ATTACHMENT,
            size:   { width, height },
        });
    }

    async readTexture({ texture, mipLevel = 0, origin = {}, size = {} }) {
        await this.device.queue.onSubmittedWorkDone();

        const gl = this.device[_].context;

        const { glTexture, glTarget, descriptor } = texture[_];

        const { bytes, webgl2 } = TEXTURE_FORMAT[descriptor.format];
        const { format, type } = webgl2;

        const { width, height, depthOrArrayLayers = 1 } = size;
        const { x = 0, y = 0, z = 0 } = origin;

        const bytesPerRow = width * bytes;

        const framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.readBuffer(gl.COLOR_ATTACHMENT0);

        const packBuffers = [];
        for(let i = z; i < depthOrArrayLayers; i++) {
            const packBuffer = gl.createBuffer();
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, packBuffer);
            gl.bufferData(gl.PIXEL_PACK_BUFFER, bytesPerRow * height, gl.STREAM_READ);

            if(glTarget === gl.TEXTURE_CUBE_MAP) {
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, glTexture, mipLevel);
            } else if(descriptor.baseArrayLayer) {
                gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, glTexture, mipLevel, i);
            } else {
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, glTexture, mipLevel);
            }

            gl.readPixels(x, y, width, height, format, type, 0);

            packBuffers[i] = packBuffer;
        }
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);

        await this.device.queue.onSubmittedWorkDone();

        const pixels = new Int8Array(bytesPerRow * height * (depthOrArrayLayers - z));
        for(let i = z; i < depthOrArrayLayers; i++) {
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, packBuffers[i]);
            gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, pixels, (i - z) * bytesPerRow * height, bytesPerRow * height);
        }

        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        
        return pixels.buffer;
    }

    createMipmapGenerator(texture) {
        const { glTexture, glTarget } = texture[_];
        const gl = this.device[_].context;

        return (commandEncoder) => {
                commandEncoder[_].command_list.push(() => {
                gl.bindTexture(glTarget, glTexture);
                gl.generateMipmap(glTarget);
            }); 
        }
    }

    getContextView(descriptor) {
        return this.device[_].contextTexture.createView(descriptor);
    }
}

export default RevGL2;