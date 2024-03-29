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
    SAMPLER_PARAMS,
    COMPARE_FUNC,
    CULL_MODE,
    BLEND_OPERATION,
    BLEND_FACTOR,
} from './constants.js';
import { WeakCache } from '../deps/utils.js';

const CHECK_FRAMEBUFFER_STATUS = false;

/**
 * Since we don't really have internal slots here, we will store everything in a symbol property.
 * I tried to use private fields but there were too many cases where the internal slots were accessed from other classes.
 */
const _ = Symbol.for('RevGAL');


/**
 * type Override<T1, T2> = Omit<T1, keyof T2> & T2;
 * @template T1
 * @template T2
 * @typedef {Omit<T1, keyof T2> & T2} Override
 */

/**
 * @param {GPUTextureFormat} format
 */
function getTextureFormatDetails(format) {
    const details = TEXTURE_FORMAT[format];
    if(!details) throw new Error(`Texture Format not supported: ${format}`);
    return details;
}

class RevGL2Extent3DStrict {
    /**
     * @param {GPUExtent3DStrict} descriptor
     */
    constructor(descriptor) {
        let width, height, depthOrArrayLayers;
        if (Symbol.iterator in descriptor) {
            ([width, height = 1, depthOrArrayLayers = 1] = descriptor);
        } else {
            ({ width, height = 1, depthOrArrayLayers = 1 } = descriptor);
        }

        this.width              = width;
        this.height             = height;
        this.depthOrArrayLayers = depthOrArrayLayers;
    }
}

class RevGL2Origin3D {
    /**
     * @param {GPUOrigin3D} descriptor
     */
    constructor(descriptor) {
        let x, y, z;
        if (Symbol.iterator in descriptor) {
            ([x = 0, y = 0, z = 0] = descriptor);
        } else {
            ({ x = 0, y = 0, z = 0 } = descriptor);
        }

        this.x = x;
        this.y = y;
        this.z = z;
    }
}

class RevGL2Color extends Array {
    /**
     * @param {GPUColor} descriptor
     */
    constructor(descriptor) {
        let r, g, b, a;
        if (Symbol.iterator in descriptor) {
            ([r = 0, g = 0, b = 0, a = 0] = descriptor);
        } else {
            ({ r = 0, g = 0, b = 0, a = 0 } = descriptor ?? {});
        }

        super(4);

        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;

        this[0] = r;
        this[1] = g;
        this[2] = b;
        this[3] = a;
    }
}

/**
 * @see https://www.w3.org/TR/webgpu/#gpuobjectbase
 *
 * @template T
 */
export class RevGL2ObjectBase {
    /**
     * @param {{ label?: string }} [descriptor]
     * @param {RevGL2Device} [device]
     */
    constructor({ label = '' } = {}, device) {
        this.label = label;
        this[_] = /** @type {T & { device: RevGL2Device }} */({ device });
    }
}

/**
 * @see https://www.w3.org/TR/webgpu/#gpu-device
 *
 * @typedef {Override<GPURenderPipelineDescriptor, {
 *  layout:   RevGL2PipelineLayout,
 *  vertex:   Override<GPUVertexState,   { module: RevGL2ShaderModule }>
 *  fragment: Override<GPUFragmentState, { module: RevGL2ShaderModule }>
 * }>} RevGL2RenderPipelineDescriptor
 *
 * @extends {RevGL2ObjectBase<{
 *  context:            WebGL2RenderingContext,
 *  contextTexture:     RevGL2Texture,
 *  contextFramebuffer: WebGLFramebuffer,
 *  glExtensions:       Partial<{
 *      EXT_texture_filter_anisotropic: EXT_texture_filter_anisotropic,
 *      EXT_color_buffer_float:         EXT_color_buffer_float,
 *      EXT_color_buffer_half_float:    EXT_color_buffer_half_float,
 *      KHR_parallel_shader_compile:    KHR_parallel_shader_compile,
 *      WEBGL_lose_context:             WEBGL_lose_context,
 *      WEBGL_compressed_texture_astc:  WEBGL_compressed_texture_astc,
 *      WEBGL_compressed_texture_etc:   WEBGL_compressed_texture_etc,
 *      EXT_texture_compression_bptc:   EXT_texture_compression_bptc,
 *  }> & { OES_draw_buffers_indexed: OES_draw_buffers_indexed },
 *  configureContext:  (options: { usage: number, format: GPUTextureFormat }) => void,
 *  noColorOutputMode: Override<GPUFragmentState, { module: RevGL2ShaderModule }>,
 * }>}
 */
export class RevGL2Device extends RevGL2ObjectBase {
    /**
     * @param {WebGL2RenderingContext} context
     */
    constructor(context) {
        super();
        const extensions = [
            'EXT_texture_filter_anisotropic',
            'EXT_color_buffer_float',
            'EXT_color_buffer_half_float',
            'OES_draw_buffers_indexed',
            // 'OES_texture_float_linear', //avoid this if possible

            'KHR_parallel_shader_compile',
            'WEBGL_lose_context',

            'WEBGL_compressed_texture_astc',
            'WEBGL_compressed_texture_etc',
            'EXT_texture_compression_bptc',
        ];

        const required = [
            'OES_draw_buffers_indexed',
            // 'EXT_color_buffer_float',
            // 'EXT_color_buffer_half_float',
            // 'OES_texture_float_linear',
        ]

        const glExtensions = /** @type {Record<string, boolean> & { OES_draw_buffers_indexed : OES_draw_buffers_indexed }}*/({});
        for(const ext of extensions) {
            glExtensions[ext] = context.getExtension(ext);
            if(!glExtensions[ext] && required.indexOf(ext) !== -1) {
                console.warn('WebGL Extension not supported:', ext);
                throw new Error('Device not supported');
            }
        }
        this[_].context = context;
        this[_].glExtensions = Object.freeze(glExtensions);

        this.limits = Object.freeze({
            maxTextureDimension2D            : /** @type {number} */(context.getParameter(GL.MAX_TEXTURE_SIZE)),
            maxTextureArrayLayers            : /** @type {number} */(context.getParameter(GL.MAX_ARRAY_TEXTURE_LAYERS)),
            maxSamplersPerShaderStage        : /** @type {number} */(context.getParameter(GL.MAX_TEXTURE_IMAGE_UNITS)),
            maxUniformBuffersPerShaderStage  : /** @type {number} */(context.getParameter(GL.MAX_UNIFORM_BUFFER_BINDINGS)),
            maxColorAttachments              : /** @type {number} */(context.getParameter(GL.MAX_COLOR_ATTACHMENTS)),
            maxColorAttachmentBytesPerSample : /** @type {number} */(context.getParameter(GL.MAX_COLOR_ATTACHMENTS) * 4),
        });

        context.pixelStorei(GL.UNPACK_FLIP_Y_WEBGL, false);

        this.queue = new RevGL2Queue({}, this);

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

        this[_].configureContext = ({ usage, format }) => this.#configureContext({ usage, format });

        this.lost = new Promise((resolve) => {
            context.canvas.addEventListener('webglcontextlost', (event) => {
                const message = /** @type {WebGLContextEvent} */(event).statusMessage;
                resolve({ message, reason: this.#destroyed ? 'destroyed' : undefined });
            }, { once: true});
        });

        this[_].noColorOutputMode = { targets: [], entryPoint: 'main', module: new RevGL2ShaderModule({ glType: GL.FRAGMENT_SHADER,  code: 'void main(void){}' }, this) };
    }

    /**
     * @param {{ usage: number, format: GPUTextureFormat }} options
     */
    #configureContext({ usage, format }) {
        const { width, height }    = this[_].context.canvas;
        this[_].contextTexture     = this.createTexture({ size: { width, height }, usage, format });
        this[_].contextFramebuffer = this.#createContextFramebuffer(this[_].contextTexture);
    }

    /**
     * @param {RevGL2Texture} texture
     */
    #createContextFramebuffer(texture) {
        const gl = this[_].context;
        const framebuffer = gl.createFramebuffer();

        if(!framebuffer) throw new Error('Failed to create framebuffer');

        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture[_].glTexture, 0);
        return framebuffer;
    }

    /** @type {boolean} */
    #destroyed = false;
    /**
     * @return {undefined}
     */
    destroy(){
        this.#destroyed = true;
        this[_].glExtensions.WEBGL_lose_context?.loseContext();
    }

    /**
     * @param {GPUBufferDescriptor} descriptor
     */
    createBuffer(descriptor) {
        return new RevGL2Buffer(descriptor, this);
    }

    /**
     * @param {GPUTextureDescriptor} descriptor
     */
    createTexture(descriptor) {
        return new RevGL2Texture(descriptor, this);
    }

    /**
     * @param {GPUSamplerDescriptor} descriptor
     */
    createSampler(descriptor) {
        return new RevGL2Sampler(descriptor, this);
    }

    /**
     * @param {GPUBindGroupLayoutDescriptor} descriptor
     */
    createBindGroupLayout(descriptor){
        return new RevGL2BindGroupLayout(descriptor, this);
    }

    /**
     * @param {RevGL2PipelineLayoutDescriptor} descriptor
     */
    createPipelineLayout(descriptor) {
        return new RevGL2PipelineLayout(descriptor, this);
    }

    /**
     * @param {RevGL2BindGroupDescriptor} descriptor
     */
    createBindGroup(descriptor) {
        return new RevGL2BindGroup(descriptor, this);
    }

    /**
     * @param {RevGL2RenderPipelineDescriptor} descriptor
     */
    createRenderPipeline(descriptor) {
        return new RevGL2RenderPipeline(descriptor, this);
    }

    /**
     * @param {RevGL2RenderPipelineDescriptor} descriptor
     */
    async createRenderPipelineAsync(descriptor) {
        const pipeline = new RevGL2RenderPipeline(descriptor, this, true);
        await pipeline[_].glProgramPromise;
        return pipeline;
    }

    /**
     * @param {GPUCommandEncoderDescriptor} descriptor
     */
    createCommandEncoder(descriptor) {
        return new RevGL2CommandEncoder(descriptor, this);
    }

    /**
     * @param {GPUShaderModuleDescriptor & { glType: typeof GL.VERTEX_SHADER | typeof GL.FRAGMENT_SHADER }} descriptor
     */
    createShaderModule(descriptor) {
        return new RevGL2ShaderModule(descriptor, this);
    }

    /**
     * @param {GPUQuerySetDescriptor} descriptor
     */
    createQuerySet(descriptor) {
        return new RevGL2QuerySet(descriptor, this);
    }
}

/**
 * @extends {RevGL2ObjectBase<{
 *  glQueries: WebGLQuery[]
 * }>}
 */
export class RevGL2QuerySet extends RevGL2ObjectBase {
    /**
     * @param {GPUQuerySetDescriptor} descriptor
     * @param {RevGL2Device} device
     */
    constructor(descriptor, device) {
        super(descriptor, device);
        this.type  = descriptor.type;
        this.count = descriptor.count;
        this[_].glQueries = this.#createQueries(descriptor);
    }

    /**
     * @param {{ count: number }} options
     */
    #createQueries({ count }) {
        const gl = this[_].device[_].context;

        const querySet = [];
        for(let i = 0; i < count; i++) {
            const query = gl.createQuery();
            if(!query) throw new Error('Failed to create query');
            querySet[i] = query;
        }
        return querySet;
    }

    /**
     * @return {undefined}
     */
    destroy() {

    }
}

/**
 * @see https://www.w3.org/TR/webgpu/#gpucommandbuffer
 *
 * @extends {RevGL2ObjectBase<{
 *  command_list: Iterable<() => void>
 * }>}
 */
export class RevGL2CommandBuffer extends RevGL2ObjectBase {
    /**
     * @param {GPUCommandBufferDescriptor} descriptor
     * @param {RevGL2Device} device
     */
    constructor(descriptor, device) {
        super(descriptor, device);
        this[_].command_list = [];
    }
}

/**
 * @see https://www.w3.org/TR/webgpu/#gpuqueue
 *
 * @extends {RevGL2ObjectBase<{}>}
 */
export class RevGL2Queue extends RevGL2ObjectBase {
    /**
     * @param {Iterable<RevGL2CommandBuffer>} commandBuffers
     */
    submit(commandBuffers) {
        const gl = this[_].device[_].context;

        for(const commandBuffer of commandBuffers){
            for(const command of commandBuffer[_].command_list){
                command();
            }
        }

        const { contextTexture, contextFramebuffer } = this[_].device[_];

        // blitframebuffer to canvas
        const { width, height } = contextTexture;

        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, contextFramebuffer);
        gl.blitFramebuffer(
            0, 0, width, height,
            0, 0, gl.canvas.width, gl.canvas.height,
            GL.COLOR_BUFFER_BIT, GL.NEAREST
        );

        gl.flush();
    }

    /**
     * @param {RevGL2Buffer} buffer
     * @param {number} bufferOffset
     * @param {BufferSource|SharedArrayBuffer} data
     * @param {number} [dataOffset]
     * @param {number} [size]
     */
    writeBuffer(buffer, bufferOffset, data, dataOffset = 0, size = 0) {
        const gl = this[_].device[_].context;

        const { glBuffer, glTarget } = buffer[_];

        gl.bindBuffer(glTarget, glBuffer);

        if(ArrayBuffer.isView(data)) {
            gl.bufferSubData(glTarget, bufferOffset, data, dataOffset, size);
        } else {
            gl.bufferSubData(glTarget, bufferOffset, data);
        }
    }

    /**
     * @param {Override<GPUImageCopyTexture, { texture: RevGL2Texture }>} destination
     * @param {BufferSource|SharedArrayBuffer} data
     * @param {GPUImageDataLayout} dataLayout
     * @param {GPUExtent3DStrict} size
     */
    writeTexture(destination, data, dataLayout, size) {
        const gl = this[_].device[_].context;

        const { texture, mipLevel = 0, origin = {} } = destination;
        const { glTexture, glTarget } = texture[_];

        const { offset = 0  } = dataLayout;
        const { width, height, depthOrArrayLayers } = new RevGL2Extent3DStrict(size);

        const { webgl2 } = getTextureFormatDetails(texture.format);

        gl.bindTexture(glTarget, glTexture);

        const { x, y, z } = new RevGL2Origin3D(origin);

        const dataView = !ArrayBuffer.isView(data) ? new Uint8Array(data) : data;

        if(glTarget === GL.TEXTURE_2D_ARRAY || glTarget === GL.TEXTURE_3D) {
            if(webgl2.compressed) {
                gl.compressedTexSubImage3D(glTarget, mipLevel, x, y, z, width, height, depthOrArrayLayers, webgl2.format, dataView, offset);
            } else {
                gl.texSubImage3D(glTarget, mipLevel, x, y, z, width, height, depthOrArrayLayers, webgl2.format, webgl2.type, dataView, offset);
            }
            // gl.texImage3D(glTarget, mipLevel, webgl2.internal, width, height, depthOrArrayLayers, 0, webgl2.format, webgl2.type, dataView, offset);
        } else if(glTarget === GL.TEXTURE_CUBE_MAP) {
            const offsetPerFace = dataView.length / 6;
            for(let i = 0; i < 6; i++) {
                if(webgl2.compressed) {
                    gl.compressedTexSubImage2D(GL.TEXTURE_CUBE_MAP_POSITIVE_X + i, mipLevel, x, y, width, height, webgl2.format, dataView, i * offsetPerFace);
                } else {
                    gl.texSubImage2D(GL.TEXTURE_CUBE_MAP_POSITIVE_X + i, mipLevel, x, y, width, height, webgl2.format, webgl2.type, dataView, i * offsetPerFace);
                }

                // gl.texImage2D(GL.TEXTURE_CUBE_MAP_POSITIVE_X + i, mipLevel, webgl2.internal, width, height, 0, webgl2.format, webgl2.type, dataView, i * offsetPerFace);
            }
        } else {
            if(webgl2.compressed) {
                gl.compressedTexSubImage2D(glTarget, mipLevel, x, y, width, height, webgl2.format, dataView, offset);
            } else {
                gl.texSubImage2D(glTarget, mipLevel, x, y, width, height, webgl2.format, webgl2.type, dataView, offset);
            }

            // gl.texImage2D(glTarget, mipLevel, webgl2.internal, width, height, 0, webgl2.format, webgl2.type, dataView, offset);
        }
    }

    /**
     * @param {GPUImageCopyExternalImage} source
     * @param {Override<GPUImageCopyTextureTagged, { texture: RevGL2Texture }>} destination
     * @param {GPUExtent3DStrict} copySize
     */
    copyExternalImageToTexture({ source }, destination, copySize) {
        const gl = this[_].device[_].context;

        const { texture, mipLevel = 0, origin = {} } = destination;
        const { glTexture, glTarget } = texture[_];

        const { format        } = texture;
        const { width, height } = new RevGL2Extent3DStrict(copySize);

        const { x, y } = new RevGL2Origin3D(origin);

        const { webgl2 } = getTextureFormatDetails(format);

        gl.bindTexture(glTarget, glTexture);
        gl.texSubImage2D(glTarget, mipLevel, x, y, width, height, webgl2.format, webgl2.type, source);
    }

    async onSubmittedWorkDone() {
        const gl = this[_].device[_].context;

        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);

        if(!sync) throw new Error('Failed to call fenceSync');

        // gl.flush();

        /** @type {Promise<void>} */
        const promise = new Promise((resolve, reject) => {
            const check = () => {
                const res = gl.clientWaitSync(sync, 0, 0);
                    if (res == gl.WAIT_FAILED) {
                        reject();
                        return;
                    }
                    if (res == gl.TIMEOUT_EXPIRED) {
                        setTimeout(check);
                        return;
                    }
                    resolve();
            }
            check();
        });

        return promise;
    }
}


/**
 * @see https://www.w3.org/TR/webgpu/#render-pass-encoder
 *
 * @typedef {Override<GPURenderPassDescriptor, {
 *  colorAttachments: Iterable<Override<GPURenderPassColorAttachment, { view: RevGL2TextureView, resolveTarget?: RevGL2TextureView }>|null>
 *  depthStencilAttachment?: Override<GPURenderPassDepthStencilAttachment, { view: RevGL2TextureView, glResolveTarget?: RevGL2TextureView  }>,
 *  occlusionQuerySet?: RevGL2QuerySet,
 * }>} RevGL2RenderPassDescriptor
 *
 * @typedef {{ attachment: number, resolveTarget?: RevGL2TextureView, glRenderbuffer?: WebGLRenderbuffer }} RenderBufferAttachment
 *
 * @extends {RevGL2ObjectBase<{
 *  descriptor:            RevGL2RenderPassDescriptor,
 *  pipeline:              null|RevGL2RenderPipeline,
 *  index_buffer:          null|RevGL2Buffer,
 *  index_offset:          null|number,
 *  index_format:          null|GPUIndexFormat,
 *  index_buffer_size:     null|number,
 *  vertex_buffers:        RevGL2Buffer[],
 *  vertex_buffer_sizes:   number[],
 *  vertex_buffer_offsets: number[],
 *  occlusion_query_set?:  RevGL2QuerySet,
 *  attachment_size:       { width: number, height: number },
 *  viewport:              { width: number, height: number, x: number, y: number },
 *  glFramebuffer:         WebGLFramebuffer,
 *  glRenderbuffers:       { colors: RenderBufferAttachment[], depth?: RenderBufferAttachment },
 *  command_encoder:       RevGL2CommandEncoder,
 *  bind_groups:           RevGL2BindGroup[],
 * }>}
 */
export class RevGL2RenderPassEncoder extends RevGL2ObjectBase {
    /**
     * @param {RevGL2RenderPassDescriptor} descriptor
     * @param {RevGL2Device} device
     * @param {RevGL2CommandEncoder} commandEncoder
     */
    constructor(descriptor, device, commandEncoder) {
        super(descriptor, device);

        this[_].descriptor = descriptor;

        this[_].pipeline            = null;
        this[_].index_buffer        = null;
        this[_].index_format        = null;
        this[_].index_offset        = null;
        this[_].index_buffer_size   = null;

        this[_].vertex_buffers        = [];
        this[_].vertex_buffer_sizes   = [];
        this[_].vertex_buffer_offsets = [];

        this[_].occlusion_query_set   = descriptor.occlusionQuerySet;

        this[_].attachment_size = this.#getAttachmentSize(descriptor);

        this[_].viewport        = { ...this[_].attachment_size, x: 0, y: 0 };

        device[_].context.disable(GL.DEPTH_TEST);
        device[_].context.disable(GL.SCISSOR_TEST);

        this[_].glFramebuffer   = this.#createFramebuffer(descriptor);
        this[_].glRenderbuffers = this.#createRenderbuffers(descriptor);

        this[_].command_encoder = commandEncoder;
        this[_].bind_groups = [];

        this[_].command_encoder[_].commands.push(() => {
            this.#beginRenderPipeline();
        });
    }

    /**
     * @param {RevGL2RenderPassDescriptor} descriptor
     */
    #getAttachmentSize(descriptor) {
        const { colorAttachments, depthStencilAttachment } = descriptor;

        if(depthStencilAttachment) {
            const { width, height } = depthStencilAttachment.view[_].renderExtent;
            return { width, height };
        }

        for(const attachment of colorAttachments){
            if(!attachment) continue;

            const { width, height } = attachment.view[_].renderExtent;
            return { width, height };
        }
        throw new Error ('Unable to get attachment size')
    }

    /**
     * @param {RevGL2RenderPassDescriptor} descriptor
     */
    #createFramebuffer(descriptor) {
        const gl = this[_].device[_].context;

        const framebuffer = gl.createFramebuffer();

        if(!framebuffer) throw new Error('Failed to create framebuffer');

        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

        const { colorAttachments, depthStencilAttachment } = descriptor;

        let i = 0;
        for(const attachment of colorAttachments) {
            if(!attachment) {
                i++;
                continue;
            }

            const { view                } = attachment;
            const { texture, descriptor } = view[_];
            const { glTexture, glTarget } = texture[_];
            const { depthOrArrayLayers  } = texture;

            const { baseArrayLayer = 0, baseMipLevel = 0 } = descriptor;

            if(glTarget === gl.TEXTURE_CUBE_MAP) {
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_CUBE_MAP_POSITIVE_X + baseArrayLayer, glTexture, baseMipLevel);
            } else if(depthOrArrayLayers > 1) {
                gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, glTexture, baseMipLevel, baseArrayLayer);
            } else {
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, glTexture, baseMipLevel);
            }
            i++
        }

        if(depthStencilAttachment) {
            const { view                } = depthStencilAttachment;
            const { texture, descriptor } = view[_];
            const { glTexture,          } = texture[_];
            const { depthOrArrayLayers  } = texture;

            const { baseArrayLayer = 0, baseMipLevel = 0, format = texture.format } = descriptor;

            const attachment = format.includes('stencil') ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT;
            if(depthOrArrayLayers > 1) {
                gl.framebufferTextureLayer(gl.FRAMEBUFFER, attachment, glTexture, baseMipLevel, baseArrayLayer);
            } else {
                gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, glTexture, baseMipLevel);
            }
        }

        if(CHECK_FRAMEBUFFER_STATUS) {
            const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
            if(status != gl.FRAMEBUFFER_COMPLETE){
                throw new Error(`Framebuffer error: ${FRAMEUBUFFER_STATUS_ERRORS[status]}`);
            }
        }

        return framebuffer;
    }

    #beginRenderPipeline() {
        const gl = this[_].device[_].context;
        const { viewport, glFramebuffer } = this[_];

        const { x, y, width, height } = viewport;

        gl.viewport(x, y, width, height);

        gl.bindFramebuffer(gl.FRAMEBUFFER, glFramebuffer);

        const { colorAttachments, depthStencilAttachment } = this[_].descriptor;

        gl.drawBuffers(/** @type {unknown[]}*/(colorAttachments).map((attachment, i) => attachment ? gl.COLOR_ATTACHMENT0 + i : gl.NONE));

        const { OES_draw_buffers_indexed: oes } = this[_].device[_].glExtensions;
        let i = 0;
        for(const attachment of colorAttachments) {
            if(!attachment) {
                i++;
                continue;
            }

            const { view, clearValue = [0, 0, 0, 0], loadOp } = attachment;
            const { texture } = view[_];

            if(loadOp !== 'load') {
                oes.colorMaskiOES(i, true, true, true, true);
                const clearMethod = getTextureFormatDetails(texture.format).webgl2.clearMethod;
                if(clearMethod !== 'clearBufferfi') { //clearBufferfi is only used for depth stencil
                    gl[clearMethod](gl.COLOR, i, new RevGL2Color(clearValue), 0);
                }
            }
            i++;
        }

        if(depthStencilAttachment) {
            const { depthLoadOp, depthClearValue = 0, stencilLoadOp, stencilClearValue = 0 } = depthStencilAttachment;

            if(depthLoadOp !== 'load' && stencilLoadOp !== 'load') {
                gl.depthMask(true);
                gl.clearBufferfi(gl.DEPTH_STENCIL, 0, depthClearValue, stencilClearValue);
            }
        }
    }

    /**
     * @param {RevGL2RenderPassDescriptor} descriptor
     */
    #createRenderbuffers({ colorAttachments = [], depthStencilAttachment }) {
        const gl = this[_].device[_].context;

        let attachment;
        for(attachment of colorAttachments) {
            if(attachment) break;
        }

        let sampleCount;
        if(attachment) {
            sampleCount = attachment.view[_].texture.sampleCount;
        } else if(depthStencilAttachment){
            sampleCount = depthStencilAttachment.view[_].texture.sampleCount;
        } else {
            throw new Error('Invalid attachment state');
        }

        const renderbuffers = /** @type {{ colors: RenderBufferAttachment[], depth?: RenderBufferAttachment }}*/({
            colors: []
        });

        if(sampleCount > 1) {
            const { glFramebuffer, attachment_size } = this[_];
            const { width, height } = attachment_size;

            gl.bindFramebuffer(gl.FRAMEBUFFER, glFramebuffer);

            let i = 0;
            for(const attachment of colorAttachments) {
                if(!attachment) {
                    renderbuffers.colors.push({ attachment: GL.NONE });
                    i++;
                    continue;
                };

                const { view, resolveTarget     } = attachment;
                const { descriptor, texture     } = view[_];
                const { format = texture.format } = descriptor;

                const { webgl2 } = getTextureFormatDetails(format);

                const attachmentIndex = gl.COLOR_ATTACHMENT0 + i;

                const glRenderbuffer = gl.createRenderbuffer();
                if(!glRenderbuffer) throw new Error('Failed to create render buffer');

                gl.bindRenderbuffer(gl.RENDERBUFFER, glRenderbuffer);
                gl.renderbufferStorageMultisample(gl.RENDERBUFFER, sampleCount, webgl2.internal, width, height);
                gl.framebufferRenderbuffer(gl.FRAMEBUFFER, attachmentIndex, gl.RENDERBUFFER, glRenderbuffer);

                renderbuffers.colors.push({ attachment: attachmentIndex, resolveTarget, glRenderbuffer });

                i++;
            }

            if(depthStencilAttachment) {
                const { view, glResolveTarget } = depthStencilAttachment;
                const { descriptor, texture     } = view[_];
                const { format = texture.format } = descriptor;

                const { webgl2 } = getTextureFormatDetails(format);

                const attachment = format.includes('stencil') ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT;

                const glRenderbuffer = gl.createRenderbuffer();
                if(!glRenderbuffer) throw new Error('Failed to create render buffer');

                gl.bindRenderbuffer(gl.RENDERBUFFER, glRenderbuffer);
                gl.renderbufferStorageMultisample(gl.RENDERBUFFER, sampleCount, webgl2.internal, width, height);
                gl.framebufferRenderbuffer(gl.FRAMEBUFFER, attachment, gl.RENDERBUFFER, glRenderbuffer);

                renderbuffers.depth = { attachment, resolveTarget: glResolveTarget, glRenderbuffer };
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

        const { glFramebuffer, glRenderbuffers: { colors, depth }, attachment_size } = this[_];
        const { width, height } = attachment_size;

        const drawFramebuffer = gl.createFramebuffer();
        const colorAttachments = /** @type {number[]} */([]);

        gl.bindFramebuffer(gl.FRAMEBUFFER, drawFramebuffer);
        for(const { resolveTarget, attachment } of colors){
            colorAttachments.push(attachment);

            if(!attachment) continue;
            if(!resolveTarget) throw new Error('No resolve target');

            const { texture, descriptor } = resolveTarget[_];
            const { glTexture } = texture[_];
            gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, glTexture, descriptor.baseMipLevel ?? 0);
        }

        if(depth) {
            const { resolveTarget, attachment } = depth;
            if(!resolveTarget) throw new Error('No resolve target');

            const { texture, descriptor } = resolveTarget[_];
            const { glTexture } = texture[_];
            gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, glTexture, descriptor.baseMipLevel ?? 0);

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
                if(colorAttachments[i] !== null) {
                    const buffers = colorAttachments.map((attachment, j) => i === j ? attachment : gl.NONE);
                    gl.drawBuffers(buffers);
                    gl.readBuffer(buffers[i]);

                    gl.blitFramebuffer(
                        0, 0, width, height,
                        0, 0, width, height,
                        GL.COLOR_BUFFER_BIT, GL.NEAREST
                    );
                }
            }
        }

        for(const { glRenderbuffer } of colors){
            if(glRenderbuffer) gl.deleteRenderbuffer(glRenderbuffer);
        }
        if(depth) {
            if(depth.glRenderbuffer) gl.deleteRenderbuffer(depth.glRenderbuffer);
        }
    }

    /**
     * @param {RevGL2RenderPipeline} pipeline
     */
    setPipeline(pipeline) {
        this[_].command_encoder[_].commands.push(() => {
            this[_].pipeline = pipeline;
        });
    }

    /**
     * @param {number} slot
     * @param {RevGL2Buffer} buffer
     * @param {number} [offset]
     * @param {number} [size]
     */
    setVertexBuffer(slot, buffer, offset = 0, size) {
        this[_].command_encoder[_].commands.push(() => {
            this[_].vertex_buffers[slot]        = buffer;
            this[_].vertex_buffer_sizes[slot]   = size ?? Math.max(0, buffer.size - offset);
            this[_].vertex_buffer_offsets[slot] = offset;
        });
    }

    /**
     * @param {RevGL2Buffer} buffer
     * @param {GPUIndexFormat} indexFormat
     * @param {number} [offset]
     * @param {number} [size]
     */
    setIndexBuffer(buffer, indexFormat, offset = 0, size) {
        this[_].command_encoder[_].commands.push(() => {
            this[_].index_buffer      = buffer;
            this[_].index_format      = indexFormat;
            this[_].index_offset      = offset;
            this[_].index_buffer_size = size ?? Math.max(0, buffer.size - offset);
        });
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     */
    setViewport(x, y, width, height) {
        const gl = this[_].device[_].context;
        const { attachment_size } = this[_];
        this[_].command_encoder[_].commands.push(() => {
            gl.viewport(x, attachment_size.height - height - y, width, height);
        });
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     */
    setScissorRect(x, y, width, height) {
        const gl = this[_].device[_].context;
        this[_].command_encoder[_].commands.push(() => {
            const { attachment_size } = this[_];
            gl.enable(gl.SCISSOR_TEST);
            gl.scissor(x, attachment_size.height - height - y, width, height);
        });
    }

    /** @type {(number[])[]} */
    #textureSlots = [];

    /**
     * @param {number} index
     * @param {RevGL2BindGroup} bindGroup
     */
    setBindGroup(index, bindGroup) {
        this[_].command_encoder[_].commands.push(() => {
            if(this[_].bind_groups[index] != bindGroup) {
                this.#textureSlots[index] = [];

                let uniformSlot = 0;
                let textureSlot = 0;

                for(let i = 0; i < index; i++) {
                    uniformSlot += this[_].bind_groups[i][_].layout[_].glUniformSlotCount;
                    textureSlot += this[_].bind_groups[i][_].layout[_].glTextureSlotCount;
                }

                const gl       = this[_].device[_].context;

                for(const { binding, resource } of bindGroup[_].entries) {
                    if('buffer' in resource) {
                        gl.bindBufferBase(gl.UNIFORM_BUFFER, uniformSlot++, resource.buffer[_].glBuffer);
                    } else if('texture' in resource[_]) {
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

        const pipeline = this[_].pipeline;

        if(!pipeline) return;

        const { glSamplerBindings } = pipeline[_];

        const bindGroups = this[_].bind_groups;

        for(const { group, texture, sampler } of glSamplerBindings) {
            const slot = this.#textureSlots[group][texture];

            if(sampler !== -1) {
                const entries = bindGroups[group][_].entries;
                const { glSampler } = /** @type {RevGL2Sampler} */(/** @type {RevGL2BindGroupEntry[]} */(entries)[sampler].resource)[_];
                gl.bindSampler(slot, glSampler);
            } else {
                gl.bindSampler(slot, null);
            }

        }
    }

    // static #pipelineVAO = new WeakMap();
    #setVertexArrays(firstInstance = 0, baseVertex = 0) {
        const gl = this[_].device[_].context;

        const { pipeline   } = this[_];

        if(!pipeline) return;

        const { descriptor } = pipeline[_];

        const [firstBuffer] = descriptor.vertex?.buffers ?? [];
        if(!firstBuffer) {
            gl.disableVertexAttribArray(0);
        }

        for(const layout of descriptor.vertex.buffers ?? []) {
            if(!layout) continue;

            const { arrayStride, attributes, stepMode } = layout;
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

        const pipeline = this[_].pipeline;

        if(!pipeline) return;

        const { descriptor, writesDepth = false, glProgram, glDrawBuffers } = pipeline[_];

        if(!glProgram) return;

        gl.drawBuffers(glDrawBuffers);

        const cullMode = descriptor.primitive?.cullMode;
        if(cullMode && cullMode !== 'none') {
            gl.enable(GL.CULL_FACE);
            gl.cullFace(CULL_MODE[cullMode]);
        } else {
            gl.disable(GL.CULL_FACE);
        }

        const frontFace = descriptor.primitive?.frontFace;
        if(frontFace === 'cw') {
            gl.frontFace(GL.CW);
        } else if(frontFace === 'ccw') {
            gl.frontFace(GL.CCW);
        }

        if(descriptor.fragment){
            const { OES_draw_buffers_indexed: oes } = this[_].device[_].glExtensions;
            let i = 0;

            for(const target of descriptor.fragment.targets) {
                if(target?.blend) {
                    const { blend, writeMask = 0xF } = target;
                    oes.enableiOES(GL.BLEND, i);
                    oes.blendFuncSeparateiOES(
                        i,
                        BLEND_FACTOR[blend.color?.srcFactor ?? 'one'],
                        BLEND_FACTOR[blend.color?.dstFactor ?? 'zero'],
                        BLEND_FACTOR[blend.alpha?.srcFactor ?? 'one'],
                        BLEND_FACTOR[blend.alpha?.dstFactor ?? 'zero'],
                    );
                    oes.blendEquationSeparateiOES(
                        i,
                        BLEND_OPERATION[blend.color?.operation ?? 'add'],
                        BLEND_OPERATION[blend.alpha?.operation ?? 'add'],
                    );
                    oes.colorMaskiOES(i, Boolean(writeMask & 0x1), Boolean(writeMask & 0x2), Boolean(writeMask & 0x4), Boolean(writeMask & 0x8));
                } else {
                    oes.disableiOES(GL.BLEND, i);
                }
                i++;
            }
        }

        if(descriptor.depthStencil) {
            gl.depthMask(writesDepth);
            gl.enable(GL.DEPTH_TEST);
            gl.depthFunc(COMPARE_FUNC[descriptor.depthStencil.depthCompare ?? 'always']);

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

    /**
     * @param {number} vertexCount
     * @param {number} [instanceCount]
     * @param {number} [firstVertex]
     * @param {number} [firstInstance]
     */
    draw(vertexCount, instanceCount = 1, firstVertex = 0, firstInstance = 0) {
        const gl = this[_].device[_].context;
        this[_].command_encoder[_].commands.push(() => {
            this.#startDraw();

            this.#bindSamplers();
            this.#setVertexArrays(firstInstance);

            const pipeline = this[_].pipeline;

            if(!pipeline) return;

            const mode = PRIMITIVE_MODES[pipeline[_].descriptor.primitive?.topology ?? 'triangle-list'];
            if(instanceCount > 1) {
                gl.drawArraysInstanced(mode, firstVertex, vertexCount, instanceCount);
            } else {
                gl.drawArrays(mode, firstVertex, vertexCount);
            }
        });
    }

    /**
     * @param {number} indexCount
     * @param {number} [instanceCount]
     * @param {number} [firstIndex]
     * @param {number} [baseVertex]
     * @param {number} [firstInstance]
     */
    drawIndexed(indexCount, instanceCount = 1, firstIndex = 0, baseVertex = 0, firstInstance = 0) {
        const gl = this[_].device[_].context;

        this[_].command_encoder[_].commands.push(() => {
            this.#startDraw();

            const pipeline    = this[_].pipeline;
            const indexBuffer = this[_].index_buffer;
            const indexFormat = this[_].index_format;
            const indexOffset = this[_].index_offset ?? 0;

            if(!pipeline || !indexBuffer || !indexFormat) return;

            this.#bindSamplers();
            this.#setVertexArrays(firstInstance, baseVertex);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer[_].glBuffer);

            const mode = PRIMITIVE_MODES[pipeline[_].descriptor.primitive?.topology ?? 'triangle-list'];
            if(instanceCount > 1) {
                gl.drawElementsInstanced(mode, indexCount, VERTEX_FORMAT[indexFormat].webgl2.type, indexOffset + firstIndex, instanceCount);
            } else {
                gl.drawElements(mode, indexCount, VERTEX_FORMAT[indexFormat].webgl2.type, indexOffset + firstIndex);
            }
        });
    }

    /** @param {number} queryIndex */
    beginOcclusionQuery(queryIndex) {
        const gl = this[_].device[_].context;
        this[_].command_encoder[_].commands.push(() => {
            const occlusion_query_set = this[_].occlusion_query_set;
            if(occlusion_query_set) gl.beginQuery(gl.ANY_SAMPLES_PASSED, occlusion_query_set[_].glQueries[queryIndex]);
        });
    }

    endOcclusionQuery() {
        const gl = this[_].device[_].context;
        this[_].command_encoder[_].commands.push(() => {
            gl.endQuery(gl.ANY_SAMPLES_PASSED);
        });
    }

    end() {
        const gl = this[_].device[_].context;

        if(this[_].glRenderbuffers.colors.length){
            this[_].command_encoder[_].commands.push(() => {
                this.#resolveRenderbuffers();
            });
        }

        this[_].command_encoder[_].commands.push(() => {
            gl.deleteFramebuffer(this[_].glFramebuffer);
        });
    }
}

/**
 * @see https://www.w3.org/TR/webgpu/#render-pipeline
 *
 * @extends {RevGL2ObjectBase<{
 *  descriptor:        RevGL2RenderPipelineDescriptor,
 *  writesDepth?:      boolean,
 *  glDrawBuffers:     (number)[],
 *  glSamplerBindings: ({ group: number, texture: number, sampler: number})[]
 *  glProgram?:        WebGLProgram,
 *  glProgramPromise?: Promise<WebGLProgram>,
 * }>}
 */
export class RevGL2RenderPipeline extends RevGL2ObjectBase {
    /**
     * @param {RevGL2RenderPipelineDescriptor} descriptor
     * @param {RevGL2Device} device
     * @param {boolean} [async]
     */
    constructor(descriptor, device, async) {
        super(descriptor, device);

        this[_].descriptor    = descriptor;
        this[_].writesDepth   = descriptor.depthStencil?.depthWriteEnabled;
        this[_].glDrawBuffers = [...(descriptor.fragment?.targets ?? [])].map((target, i) => target && (target.writeMask ?? 0xF) ? GL.COLOR_ATTACHMENT0 + i : GL.NONE);

        if(async) {
            this[_].glProgramPromise = this.#getProgramAsync(descriptor);
        } else {
            this.#getProgram(descriptor);
        }
    }

    /**
     * @type {WeakCache<{ program: Promise<WebGLProgram> }>}
     */
    static #programCacheAsync = new WeakCache();

    /**
     * @type {WeakCache<{ program: WebGLProgram }>}
     */
    static #programCache = new WeakCache();

    /**
     * @param {RevGL2RenderPipelineDescriptor} descriptor
     */
    async #getProgramAsync(descriptor) {
        const { vertex, fragment = this[_].device[_].noColorOutputMode } = descriptor;

        const cache = RevGL2RenderPipeline.#programCacheAsync.ensure(vertex.module, fragment.module, () => ({
            program: this.#compileProgramAsync(vertex, fragment)
        }));

        const program = await cache.program;

        this[_].glProgram = program;
        this.#setBindingUniforms(program, descriptor);

        return program;
    }

    /**
     * @param {Override<GPUVertexState,   { module: RevGL2ShaderModule }>} vertex
     * @param {Override<GPUFragmentState, { module: RevGL2ShaderModule }>} fragment
     */
    async #compileProgramAsync(vertex, fragment) {
        const gl = this[_].device[_].context;

        const program = gl.createProgram();

        if(!program) throw new Error('Failed to create program');

        gl.attachShader(program, vertex.module[_].glShader);
        gl.attachShader(program, fragment.module[_].glShader);
        gl.linkProgram(program);

        const ext = gl.getExtension('KHR_parallel_shader_compile');
        if (ext) {
            while(!gl.getProgramParameter(program, ext.COMPLETION_STATUS_KHR)) {
                await new Promise(resolve => queueMicrotask(() => resolve(null)))
            }
        }

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const log = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            console.warn('Failed to create program', log);
            throw new Error(`Error linking program: ${log}`);
        }

        return program;
    }

    /**
     * @param {RevGL2RenderPipelineDescriptor} descriptor
     */
    #getProgram(descriptor) {
        const { vertex, fragment = this[_].device[_].noColorOutputMode } = descriptor;

        const cache = RevGL2RenderPipeline.#programCache.ensure(vertex.module, fragment.module, () => ({
            program: this.#compileProgram(vertex, fragment)
        }));

        const program = cache.program;

        this[_].glProgram = program;
        this.#setBindingUniforms(program, descriptor);

        return program;
    }

    /**
     * @param {Override<GPUVertexState,   { module: RevGL2ShaderModule }>} vertex
     * @param {Override<GPUFragmentState, { module: RevGL2ShaderModule }>} fragment
     */
    #compileProgram(vertex, fragment) {
        const gl = this[_].device[_].context;
        const program = gl.createProgram();

        if(!program) throw new Error('Failed to create program');

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

    /**
     * @param {RevGL2PipelineLayout} layout
     */
    #getBindingSlots(layout) {
        /** @type {(number[])[]} */
        const bindingSlots = [];

        const { bindGroupLayouts } = layout[_].descriptor;

        let textureSlot = 0, uniformSlot = 0;
        let g = 0;

        for(const bindGroupLayout of bindGroupLayouts) {
            bindingSlots[g] = [];
            for(let b = 0; b < bindGroupLayout[_].entryMap.length; b++) {
                const { texture, buffer } = bindGroupLayout[_].entryMap[b];

                if(buffer !== undefined) {
                    bindingSlots[g][b] = uniformSlot++;
                }

                if(texture !== undefined) {
                    bindingSlots[g][b] = textureSlot++;
                }
            }
            g++;
        }

        return bindingSlots;
    }

    /**
     * @param {WebGLProgram} program
     * @param {RevGL2RenderPipelineDescriptor} descriptor
     */
    #setBindingUniforms(program, { layout, fragment, vertex }) {
        const gl = this[_].device[_].context;

        const bindingSlots = this.#getBindingSlots(layout)

        gl.useProgram(program);

        const vertSrc = gl.getShaderSource(vertex.module[_].glShader);
        const fragSrc = gl.getShaderSource(fragment.module[_].glShader);

        if(!vertSrc || !fragSrc) throw new Error('Failed to get shader source');

        const source = vertSrc + fragSrc;

        let match;

        while((match = RevGL2RenderPipeline.UNIFORM_BINDING_REGEX.exec(source))) {
            const [,name, group, binding] = match;
            const location = gl.getUniformBlockIndex(program, name);
            if(location !== undefined) {
                const slot = bindingSlots[Number(group)][Number(binding)];
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
                const slot = bindingSlots[Number(group)][Number(binding)];
                gl.uniform1i(location, slot);

                samplerBindings.push({ group: Number(group), texture: Number(binding), sampler: sampler ? Number(sampler) : -1 });
            }

        }

        this[_].glSamplerBindings = samplerBindings;
    }

    static UNIFORM_BINDING_REGEX = /#pragma revUniformBinding\((\w+),\s+?(\d+),\s+?(\d+)\)/g;
    static TEXTURE_BINDING_REGEX = /#pragma revTextureBinding\((\w+),\s+?(\d+),\s+?(\d+)(?:,\s+?(\d+))?\)/g;

    /**
     * @param {number} index
     * @return {GPUBindGroupLayout}
     */
    getBindGroupLayout(index) {
        throw new Error('getBindGroupLayout not implemented');
    }
}

/**
 * @see https://www.w3.org/TR/webgpu/#command-encoder
 *
 * @extends {RevGL2ObjectBase<{
 *  commands: (() => void)[],
 * }>}
 */
export class RevGL2CommandEncoder extends RevGL2ObjectBase {
    /**
     * @param {GPUCommandEncoderDescriptor} descriptor
     * @param {RevGL2Device} device
     */
    constructor(descriptor, device) {
        super(descriptor, device);
        this[_].commands = [];
    }

    /**
     * @param {RevGL2RenderPassDescriptor} descriptor
     */
    beginRenderPass(descriptor) {
        return new RevGL2RenderPassEncoder(descriptor, this[_].device, this);
    }

    // /**
    //  * @param {GPUComputePassDescriptor} descriptor
    //  * @return {GPUComputePassEncoder}
    //  */
    // beginComputePass(descriptor) {
    //     throw new Error('beginComputePass not implemented');
    // }

    /**
     * @param {Override<GPUImageCopyTexture, { texture: RevGL2Texture }>} source
     * @param {Override<GPUImageCopyTexture, { texture: RevGL2Texture }>} destination
     * @param {GPUExtent3DStrict} size
     */
    copyTextureToTexture(source, destination, size) {
        this[_].commands.push(() => {
            const gl = this[_].device[_].context;

            const { mipLevel: srcMipLevel = 0 } = source;
            const { mipLevel: dstMipLevel = 0 } = destination;

            const { x: srcX, y: srcY, z: srcZ } = new RevGL2Origin3D(source.origin ?? {});
            const { x: dstX, y: dstY, z: dstZ } = new RevGL2Origin3D(destination.origin ?? {});

            const { glTexture: srcTexture, glTarget: srcTarget } = source.texture[_];
            const { glTexture: dstTexture, glTarget: dstTarget } = destination.texture[_];

            const { width, height, depthOrArrayLayers } = new RevGL2Extent3DStrict(size);

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

    // /**
    //  * Not yet implemented
    //  *
    //  * @param {RevGL2Buffer} source
    //  * @param {GPUSize64} sourceOffset
    //  * @param {RevGL2Buffer} destination
    //  * @param {GPUSize64} destinationOffset
    //  * @param {GPUSize64} size
    //  */
    // copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
    //     throw new Error('copyBufferToBuffer not implemented');
    // }

    // /**
    //  * Not yet implemented
    //  * @param {Override<GPUImageCopyBuffer,  { buffer: RevGL2Buffer }>} source
    //  * @param {Override<GPUImageCopyTexture, { texture: RevGL2Texture }>} destination
    //  * @param {GPUExtent3DStrict} copySize
    //  */
    // copyBufferToTexture(source, destination, copySize) {
    //     throw new Error('copyBufferToTexture not implemented');
    // }

    // /**
    //  * Not yet implemented
    //  * @param {Override<GPUImageCopyTexture, { texture: RevGL2Texture }>} source
    //  * @param {Override<GPUImageCopyBuffer,  { buffer: RevGL2Buffer }>} destination
    //  * @param {GPUExtent3DStrict} copySize
    //  */
    // copyTextureToBuffer(source, destination, copySize) {
    //     throw new Error('copyTextureToBuffer not implemented');
    // }

    // /**
    //  * Not yet implemented
    //  * @param {RevGL2Buffer} buffer
    //  * @param {GPUSize64} [offset]
    //  * @param {GPUSize64} [size]
    //  */
    // clearBuffer(buffer, offset, size) {
    //     throw new Error('clearBuffer not implemented');
    // }

    // /**
    //  * Not yet implemented
    //  * @param {RevGL2QuerySet} querySet
    //  * @param {GPUSize32} queryIndex
    //  */
    // writeTimestamp(querySet, queryIndex){
    //     throw new Error('writeTimestamp not implemented');
    // }

    // /**
    //  * Not yet implemented
    //  * @param {RevGL2QuerySet} querySet
    //  * @param {GPUSize32} firstQuery
    //  * @param {GPUSize32} queryCount
    //  * @param {RevGL2Buffer} destination
    //  * @param {GPUSize64} destinationOffset
    //  */
    // resolveQuerySet(querySet, firstQuery, queryCount, destination, destinationOffset) {
    //     throw new Error('resolveQuerySet not implemented');
    // }

    /**
     * @param {GPUCommandBufferDescriptor} [descriptor]
     * @return {import('./revgal.js').REVCommandBuffer}
     */
    finish(descriptor = {}){
        const buffer = new RevGL2CommandBuffer(descriptor, this[_].device);
        buffer[_].command_list = this[_].commands.slice();
        return buffer;
    }

    // /**
    //  * Not yet implemented
    //  * @param {string} groupLabel
    //  */
    // pushDebugGroup(groupLabel){
    //     throw new Error('pushDebugGroup not implemented');
    // }

    // /**
    //  * Not yet implemented
    //  */
    // popDebugGroup(){
    //     throw new Error('popDebugGroup not implemented');
    // }
    // /**
    //  * Not yet implemented
    //  * @param {string} markerLabel
    //  */
    // insertDebugMarker(markerLabel){
    //     throw new Error('markerLabel not implemented');
    // }
}

/**
 * @see https://www.w3.org/TR/webgpu/#buffer-interface
 *
 * @extends {RevGL2ObjectBase<{
 *  glTarget: number,
 *  glBuffer: WebGLBuffer,
 *  mapping:  null|ArrayBuffer
 * }>}
 */
export class RevGL2Buffer extends RevGL2ObjectBase {
    /** @type {GPUBufferMapState} */
    mapState;

    /**
     * @param {GPUBufferDescriptor} descriptor
     * @param {RevGL2Device} device
     */
    constructor(descriptor, device) {
        super(descriptor, device);

        const { size, usage, mappedAtCreation } = descriptor;

        const gl = this[_].device[_].context;

        const target = this.#getTarget(usage);
        const buffer = gl.createBuffer();

        if(!buffer) throw new Error('Failed to create buffer');

        gl.bindBuffer(target, buffer);
        gl.bufferData(target, size, this.#getUsagePattern(usage));

        this.size     = size;
        this.usage    = usage;
        this.mapState = mappedAtCreation ? 'pending' : 'unmapped';


        this[_].glTarget = target;
        this[_].glBuffer = buffer;

        if(mappedAtCreation) {
            this[_].mapping = new ArrayBuffer(size);
        }
    }

    /**
     * @param {number} usage
     */
    #getUsagePattern(usage) {
        if(usage & (BUFFER_USAGE.INDEX | BUFFER_USAGE.UNIFORM)) {
            return GL.DYNAMIC_DRAW;
        }

        return GL.STATIC_DRAW;
    }


    /**
     * @param {number} usage
     */
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
     *
     * @param {number} [offset]
     * @param {number} [size]
     */
    getMappedRange(offset = 0, size) {
        const { mapState } = this;
        const rangeSize = size ?? Math.max(0, this.size - offset);

        if(offset !== 0 || rangeSize !== this.size) {
            throw new Error('Full range required for RevGL2');
        }
        if(!['mapped', 'pending'].includes(mapState) || !this[_].mapping) {
            throw new Error('Buffer not in mapped state');
        }

        return this[_].mapping;
    }

    /**
     * @return {undefined}
     */
    unmap() {
        const { mapState } = this;
        const { glBuffer, glTarget } = this[_];

        if(!['mapped', 'pending'].includes(mapState) || !this[_].mapping) {
            throw new Error('Buffer not in mapped state');
        }
        const gl = this[_].device[_].context;

        gl.bindBuffer(glTarget, glBuffer);
        gl.bufferSubData(glTarget, 0, this[_].mapping);

        this[_].mapping = null;
        this.mapState = 'unmapped';
    }

    /**
     * @return {Promise<undefined>}
     */
    async mapAsync() {
        throw new Error('mapAsync not implemented yet in RevGL2');
    }

    /**
     * @return {undefined}
     */
    destroy() {
        this[_].device[_].context.deleteBuffer(this[_].glBuffer);
    }
}

/**
 * @see https://www.w3.org/TR/webgpu/#gpu-textureview
 *
 * @extends {RevGL2ObjectBase<{
 *  descriptor:   GPUTextureViewDescriptor,
 *  texture:      RevGL2Texture,
 *  renderExtent: RevGL2Extent3DStrict
 * }>}
 */
export class RevGL2TextureView extends RevGL2ObjectBase {

    /**
     * @param {GPUTextureViewDescriptor} descriptor
     * @param {RevGL2Device} device
     * @param {RevGL2Texture} texture
     */
    constructor(descriptor, device, texture) {
        descriptor = RevGL2TextureView.#resolveDefaultViewDescriptor(texture, descriptor);

        super(descriptor, device);

        this[_].descriptor = descriptor;
        this[_].texture    = texture;

        if(this[_].texture.usage & TEXTURE_USAGE.RENDER_ATTACHMENT) {
            this[_].renderExtent = this.#computeRenderExtent(texture, descriptor.baseMipLevel);
        }
    }

    /**
     * @see https://www.w3.org/TR/webgpu/#texture-view-creation
     *
     * @param {RevGL2Texture} texture
     * @param {GPUTextureViewDescriptor} [descriptor]
     */
    static #resolveDefaultViewDescriptor(texture, { format, dimension, aspect = 'all', baseMipLevel = 0, mipLevelCount, baseArrayLayer = 0, arrayLayerCount } = {}) {

        const resolved = { format, dimension, aspect, baseMipLevel, mipLevelCount, baseArrayLayer, arrayLayerCount };

        resolved.format        ??= texture.format;
        resolved.mipLevelCount ??= texture.mipLevelCount - baseMipLevel;
        resolved.dimension     ??= texture.dimension;

        if(resolved.arrayLayerCount === undefined) {
            if(['1d', '2d', '3d'].includes(resolved.dimension)) resolved.arrayLayerCount = 1;
            if(resolved.dimension === 'cube') resolved.arrayLayerCount = 6;
            if(['2d-array', 'cube-array'].includes(resolved.dimension)) {
                resolved.arrayLayerCount = texture.depthOrArrayLayers - baseArrayLayer;
            }
        }
        return resolved;
    }

    /**
     * @param {{ width: number, height: number }} size
     * @param {number} [baseMipLevel]
     */
    #computeRenderExtent({ width, height }, baseMipLevel = 0) {
        return {
            width: Math.max(1, width >> baseMipLevel),
            height: Math.max(1, height >> baseMipLevel),
            depthOrArrayLayers: 1
        }
    }
}

/**
 * @see https://www.w3.org/TR/webgpu/#texture-interface
 *
 * @typedef {typeof GL.TEXTURE_2D | typeof GL.TEXTURE_2D_ARRAY | typeof GL.TEXTURE_3D | typeof GL.TEXTURE_CUBE_MAP} GLTextureTarget
 *
 * @extends {RevGL2ObjectBase<{
 *  glTarget:  GLTextureTarget
 *  glTexture: WebGLTexture
 * }>}
 */
export class RevGL2Texture extends RevGL2ObjectBase {
    #descriptor;
    /**
     * @param {GPUTextureDescriptor & { glArray?: boolean, glCubemap?: boolean }} descriptor
     * @param {RevGL2Device} device
     */
    constructor(descriptor, device) {
        super(descriptor, device);

        const { size, format, usage, mipLevelCount = 1, sampleCount = 1, dimension = '2d', glCubemap = false, glArray = false } = descriptor;
        const { width, height, depthOrArrayLayers = 1 } = new RevGL2Extent3DStrict(size);

        this.#descriptor = { size: { width, height, depthOrArrayLayers }, format, usage, mipLevelCount, sampleCount, dimension };

        const target = this.#getTarget({ dimension, depthOrArrayLayers, glCubemap, glArray });

        this[_].glTarget  = target;
        this[_].glTexture = this.#createTexture({ target, width, height, depthOrArrayLayers, format, mipLevelCount });
    }

    get width() {
        return this.#descriptor.size.width;
    }

    get height() {
        return this.#descriptor.size.height;
    }

    get depthOrArrayLayers() {
        return this.#descriptor.size.depthOrArrayLayers;
    }

    get mipLevelCount() {
        return this.#descriptor.mipLevelCount;
    }

    get sampleCount() {
        return this.#descriptor.sampleCount;
    }

    get dimension() {
        return this.#descriptor.dimension;
    }

    get format() {
        return this.#descriptor.format;
    }

    get usage() {
        return this.#descriptor.usage;
    }

    /**
     * @param {{ dimension: GPUTextureDimension, depthOrArrayLayers: number, glCubemap: boolean, glArray: boolean }} options
     */
    #getTarget({ dimension, depthOrArrayLayers, glCubemap, glArray }) {
        if(dimension === '3d') {
            return GL.TEXTURE_3D;
        } else if(glCubemap) {
            return GL.TEXTURE_CUBE_MAP;
        } else if(glArray || depthOrArrayLayers > 1) {
            return GL.TEXTURE_2D_ARRAY;
        }
        return GL.TEXTURE_2D;
    }

    /**
     * @param {{ target: GLTextureTarget, width: number, height: number, depthOrArrayLayers: number, format: GPUTextureFormat, mipLevelCount?: number }} options
     */
    #createTexture({ target, width, height, depthOrArrayLayers, format, mipLevelCount = 1 }) {
        const gl = this[_].device[_].context;

        if(!TEXTURE_FORMAT[format]) throw new Error('Texture format not supported');

        const { webgl2 } = getTextureFormatDetails(format);

        const texture = gl.createTexture();

        if(!texture) throw new Error('Failed to create texture');

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

    /**
     * @param {GPUTextureViewDescriptor} [descriptor]
     */
    createView(descriptor = {}){
        return new RevGL2TextureView(descriptor, this[_].device, this);
    }

    /**
     * @return {undefined}
     */
    destroy() {
        this[_].device[_].context.deleteTexture(this[_].glTexture);
    }
}

/**
 * @see https://www.w3.org/TR/webgpu/#sampler-interface
 *
 * @extends {RevGL2ObjectBase<{
 *  descriptor: GPUSamplerDescriptor,
 *  glSampler: WebGLSampler,
 * }>}
 */
export class RevGL2Sampler extends RevGL2ObjectBase {
    /**
     * @param {GPUSamplerDescriptor} descriptor
     * @param {RevGL2Device} device
     */
    constructor(descriptor, device) {
        super(descriptor, device);

        this[_].descriptor = descriptor;
        this[_].glSampler  = this.#createSampler(descriptor);
    }

    /**
     * @param {GPUSamplerDescriptor} descriptor
     */
    #createSampler(descriptor = {}) {
        const gl = this[_].device[_].context;

        const {
            minFilter    = 'nearest',
            magFilter    = 'nearest',
            mipmapFilter = 'nearest',
            addressModeU = 'clamp-to-edge',
            addressModeV = 'clamp-to-edge',
            addressModeW = 'clamp-to-edge',
            lodMinClamp  = 0,
            lodMaxClamp  = 32,
            compare,
            maxAnisotropy = 1,
        } = descriptor;

        const sampler = gl.createSampler();

        if(!sampler) throw new Error('Failed to create sampler');

        gl.samplerParameteri(sampler, GL.TEXTURE_MAG_FILTER, SAMPLER_PARAMS.magFilterMode[magFilter]);
        gl.samplerParameteri(sampler, GL.TEXTURE_MIN_FILTER, mipmapFilter ? SAMPLER_PARAMS.minFilterMode[`${minFilter}:${mipmapFilter}`] : SAMPLER_PARAMS.minFilterMode[minFilter]);

        gl.samplerParameteri(sampler, GL.TEXTURE_WRAP_S, SAMPLER_PARAMS.addressMode[addressModeU]);
        gl.samplerParameteri(sampler, GL.TEXTURE_WRAP_T, SAMPLER_PARAMS.addressMode[addressModeV]);
        gl.samplerParameteri(sampler, GL.TEXTURE_WRAP_R, SAMPLER_PARAMS.addressMode[addressModeW]);
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

    /**
     * @return {undefined}
     */
    destroy() {
        this[_].device[_].context.deleteSampler(this[_].glSampler);
    }
}

/**
 * @see https://www.w3.org/TR/webgpu/#gpu-bind-group
 *
 * @typedef {Override<GPUBufferBinding, {
 *  buffer: RevGL2Buffer,
 * }>} RevGL2BufferBinding
 *
 * @typedef {Override<GPUBindGroupEntry, {
 *   resource: | RevGL2Sampler | RevGL2TextureView | RevGL2BufferBinding,
 * }>}RevGL2BindGroupEntry
 *
 * @typedef {Override<GPUBindGroupDescriptor, {
 *  layout: RevGL2BindGroupLayout,
 *  entries: Iterable<RevGL2BindGroupEntry>,
 * }>} RevGL2BindGroupDescriptor
 *
 * @extends {RevGL2ObjectBase<{
 *  layout:  RevGL2BindGroupLayout,
 *  entries: Iterable<RevGL2BindGroupEntry>,
 * }>}
 */
export class RevGL2BindGroup extends RevGL2ObjectBase {
    /**
     * @param {RevGL2BindGroupDescriptor} descriptor
     * @param {RevGL2Device} device
     */
    constructor(descriptor, device) {
        super(descriptor, device);

        const { layout, entries } = descriptor;

        this[_].layout  = layout;
        this[_].entries = entries;
    }
}

/**
 * @see https://www.w3.org/TR/webgpu/#bind-group-layout
 *
 * @extends {RevGL2ObjectBase<{
 *  descriptor:         GPUBindGroupLayoutDescriptor,
 *  entryMap:           GPUBindGroupLayoutEntry[],
 *  glUniformSlotCount: number,
 *  glTextureSlotCount: number,
 * }>}
 */
export class RevGL2BindGroupLayout extends RevGL2ObjectBase {
    /**
     * @param {GPUBindGroupLayoutDescriptor} descriptor
     * @param {RevGL2Device} device
     */
    constructor(descriptor, device) {
        super(descriptor, device);

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

/**
 * @typedef {Override<GPUPipelineLayoutDescriptor, { bindGroupLayouts: Iterable<RevGL2BindGroupLayout> }>} RevGL2PipelineLayoutDescriptor
 *
 * @extends {RevGL2ObjectBase<{
 *  descriptor: RevGL2PipelineLayoutDescriptor
 * }>}
 */
export class RevGL2PipelineLayout extends RevGL2ObjectBase {
    /**
     * @param {RevGL2PipelineLayoutDescriptor} descriptor
     * @param {RevGL2Device} device
     */
    constructor(descriptor, device) {
        super(descriptor, device);
        this[_].descriptor = descriptor;
    }
}

let shaderId = 0;

/**
 * @extends {RevGL2ObjectBase<{
 *  glShader: WebGLShader
 * }>}
 */
export class RevGL2ShaderModule extends RevGL2ObjectBase {
    /**
     * @param {GPUShaderModuleDescriptor & {glType: typeof GL.VERTEX_SHADER | typeof GL.FRAGMENT_SHADER }} descriptor
     * @param {RevGL2Device} device
     */
    constructor({ glType, ...descriptor }, device) {
        super(descriptor, device);
        this.id = shaderId++;

        const shader = device[_].context.createShader(glType);

        if(!shader) throw new Error('Failed to create shader');

        this[_].glShader = shader;

        device[_].context.shaderSource(this[_].glShader, descriptor.code + `\n//* ${descriptor.label} *//`);
        device[_].context.compileShader(this[_].glShader);
    }

    async getCompilationInfo() {
        await null; //defer to next micro tick

        const gl  = this[_].device[_].context;

        if (!gl.getShaderParameter(this[_].glShader, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(this[_].glShader);
            if(!log) throw new Error('Failed to collect shader info log');
            const [,linePos = -1, lineNum = -1, message = '???'] = log.match(/ERROR: (\d+):(\d+): (.*)/) ?? [];
            return { messages: [{ type: /** @type {GPUCompilationMessageType} */('error'), linePos: Number(linePos), lineNum: Number(lineNum), message, offset: 0, length: 0 }] };
        }
        return { messages: [] };
    }
}

/**
 * @extends {RevGAL<WebGL2RenderingContext, RevGL2Device>}
 */
export class RevGL2 extends RevGAL {
    /**
     * @param {WebGL2RenderingContext|HTMLCanvasElement|OffscreenCanvas} target
     */
    constructor(target) {
        let context;

        if(target instanceof WebGL2RenderingContext) {
            context = target;
        } else if(RevGAL.isCanvas(target)) {
            context = target.getContext('webgl2', { antialias: false });
            if(!context) throw new Error('Failed to get context: Make sure that WebGL2 is supported');
        } else {
            throw new Error('Invalid target');
        }

        super({ context, device: new RevGL2Device(context), api: 'webgl2', language: 'glsl', ndcZO: false, presentationFormat: 'rgba8unorm' });
    }

    reconfigure(){
        this.device[_].configureContext({
            format: this.presentationFormat,
            usage:  TEXTURE_USAGE.RENDER_ATTACHMENT,
        });
    }

    /**
     * @param {RevGL2Texture} texture
     * @param {{ origin?: GPUOrigin3D, size?: GPUExtent3DStrict, mipLevel?: number }} [options]
     */
    async readTexture(texture, { origin, size, mipLevel = 0 } = {}) {
        await this.device.queue.onSubmittedWorkDone();

        const gl = this.device[_].context;

        const { glTexture, glTarget } = texture[_];

        const { bytes, webgl2 } = getTextureFormatDetails(texture.format);
        const { format, type } = webgl2;

        const { width, height, depthOrArrayLayers = 1 } = size ? new RevGL2Extent3DStrict(size) : texture;
        const { x, y, z } = new RevGL2Origin3D(origin ?? {});

        const bytesPerRow = bytes * width;

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
            } else if(depthOrArrayLayers > 1) {
                gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, glTexture, mipLevel, i);
            } else {
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, glTexture, mipLevel);
            }

            gl.readPixels(x, texture.height - y, width, height, format, type, 0);

            packBuffers[i] = packBuffer;
        }
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);

        await this.device.queue.onSubmittedWorkDone();

        const pixels = new Uint8Array(bytesPerRow * height * depthOrArrayLayers);
        for(let i = z; i < depthOrArrayLayers; i++) {
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, packBuffers[i]);
            gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, pixels, (i - z) * bytesPerRow * height, bytesPerRow * height);
        }

        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        return pixels.buffer;
    }

    /**
     * Creates a mipmap generator function for the given texture
     *
     * @param {RevGL2Texture} texture
     */
    createMipmapGenerator(texture) {
        const { glTexture, glTarget } = texture[_];
        const gl = this.device[_].context;

        /** @type {( commandEncoder: RevGL2CommandEncoder ) => void} */
        return (commandEncoder) => {
                commandEncoder[_].commands.push(() => {
                gl.bindTexture(glTarget, glTexture);
                gl.generateMipmap(glTarget);
            });
        }
    }

    getContextView() {
        return this.device[_].contextTexture.createView();
    }

    /**
     * @param {RevGL2QuerySet} querySet
     */
    async resolveOcclusionQuerySet(querySet) {
        const gl = this.device[_].context;
        const { glQueries } = querySet[_];

        return new BigInt64Array(await Promise.all(glQueries.map(async (query) => {
            while(!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
                await new Promise(resolve => this.requestAnimationFrame(() => resolve(null)));
            };
            return BigInt(gl.getQueryParameter(query, gl.QUERY_RESULT));
        })));
    }
}
