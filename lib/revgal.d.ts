/**
 * Reverly Engine Graphics API Abstraction Layer
 *
 * An abstraction around the WebGPU and WebGL2 APIs using the lowest common denominator.
 * This is not meant to be feature complete and only includes functionality required by the Revelry Engine render paths.
 * Some method comments borrowed from https://github.com/gpuweb/types becuase Typescript does not provide a way to inherit documentation comments.
 */
import type { TypedArray      } from '../deps/utils.js';
import type { Texture         } from '../deps/gltf.js';
import type { DepthAttachment } from './render-paths/render-node.js';
import type { ShaderConstructor, ShaderInitialized } from './render-paths/common/shaders/shader.js';

type GL = WebGL2RenderingContext

type Override<T1, T2> = Omit<T1, keyof T2> & T2;
type Debrand<T>  = Omit<T, '__brand'>;

interface REVBuffer           extends Debrand<GPUBuffer> {}
interface REVTextureView      extends Debrand<GPUTextureView> {}
interface REVSampler          extends Debrand<GPUSampler> {}
interface REVBindGroupLayout  extends Debrand<GPUBindGroupLayout> {}
interface REVBindGroup        extends Debrand<GPUBindGroup> {}
interface REVPipelineLayout   extends Debrand<GPUPipelineLayout> {}
interface REVCommandBuffer    extends Debrand<GPUCommandBuffer> {}
interface REVQuerySet         extends Debrand<GPUQuerySet> {}

interface REVBufferBinding               extends Override<GPUBufferBinding,               { buffer: REVBuffer }> {}
interface REVImageCopyBuffer             extends Override<GPUImageCopyTexture,            { buffer: REVBuffer }> {}
interface REVImageCopyTexture            extends Override<GPUImageCopyTexture,            { texture: REVTexture }> {}
interface REVImageCopyTextureTagged      extends Override<GPUImageCopyTextureTagged,      { texture: REVTexture }> {}
interface REVShaderModuleCompilationHint extends Override<GPUShaderModuleCompilationHint, { layout?: REVPipelineLayout | "auto" }> {}
interface REVBindGroupEntry              extends Override<GPUBindGroupEntry,              { resource: REVTextureView | REVSampler | REVBufferBinding }> {}

interface REVTexture extends Override<Debrand<GPUTexture>, {
    /**
     * Creates a {@link GPUTextureView}.
     * @param descriptor - Description of the {@link GPUTextureView} to create.
     */
    createView(descriptor?: GPUTextureViewDescriptor): REVTextureView
}> {}
interface REVShaderModule extends Override<Debrand<GPUShaderModule>, {
    /**
     * Returns any messages generated during the {@link GPUShaderModule}'s compilation.
     * The locations, order, and contents of messages are implementation-defined.
     * In particular, messages may not be ordered by {@link GPUCompilationMessage#lineNum}.
     */
    getCompilationInfo(): Promise<Override<Debrand<GPUCompilationInfo>, { messages: ReadonlyArray<Debrand<GPUCompilationMessage>> }>>
}> {}
interface REVRenderPipeline extends Override<Debrand<GPURenderPipeline>, {
    /**
     * Gets a {@link GPUBindGroupLayout} that is compatible with the {@link GPUPipelineBase}'s
     * {@link GPUBindGroupLayout} at `index`.
     * @param index - Index into the pipeline layout's {@link GPUPipelineLayout#[[bindGroupLayouts]]}
     * 	sequence.
     */
    getBindGroupLayout(index: number): REVBindGroupLayout
}> {}

interface REVBindGroupDescriptor extends Override<GPUBindGroupDescriptor, {
    layout: REVBindGroupLayout,
    entries: Iterable<REVBindGroupEntry>
}> {}

interface REVPipelineLayoutDescriptor extends Override<GPUPipelineLayoutDescriptor, {
    bindGroupLayouts: Iterable<REVBindGroupLayout>
}> {}

interface REVRenderPipelineDescriptor extends Override<GPURenderPipelineDescriptor, {
    layout:    REVPipelineLayout|GPUAutoLayoutMode,
    vertex:    Override<GPUVertexState,   { module: REVShaderModule }>,
    fragment?: Override<GPUFragmentState, { module: REVShaderModule }>,
}> {}

interface REVRenderPassDescriptor extends Override<GPURenderPassDescriptor, {
    colorAttachments: Iterable<Override<GPURenderPassColorAttachment, {
        view: REVTextureView
        resolveTarget?: REVTextureView
    }> | null>;
    depthStencilAttachment?: Override<GPURenderPassDepthStencilAttachment, {
        view: REVTextureView,
        glResolveTarget?: REVTextureView,
    }>;
    occlusionQuerySet?: REVQuerySet;
}> {}

interface REVShaderModuleDescriptor extends Override<GPUShaderModuleDescriptor, {
    compilationHints?: REVShaderModuleCompilationHint[]
}> {}

/** {@link GPURenderPassEncoder} */
interface REVRenderPassEncoder {
    /**
     * Sets the viewport used during the rasterization stage to linearly map from
     * NDC|normalized device coordinates to viewport coordinates.
     * @param x - Minimum X value of the viewport in pixels.
     * @param y - Minimum Y value of the viewport in pixels.
     * @param width - Width of the viewport in pixels.
     * @param height - Height of the viewport in pixels.
     * @param minDepth - Minimum depth value of the viewport.
     * @param maxDepth - Maximum depth value of the viewport.
     */
    setViewport(x: number, y: number, width: number, height: number, minDepth: number, maxDepth: number): void;
    /**
     * Sets the scissor rectangle used during the rasterization stage.
     * After transformation into viewport coordinates any fragments which fall outside the scissor
     * rectangle will be discarded.
     * @param x - Minimum X value of the scissor rectangle in pixels.
     * @param y - Minimum Y value of the scissor rectangle in pixels.
     * @param width - Width of the scissor rectangle in pixels.
     * @param height - Height of the scissor rectangle in pixels.
     */
    setScissorRect(x: GPUIntegerCoordinate, y: GPUIntegerCoordinate, width: GPUIntegerCoordinate, height: GPUIntegerCoordinate): void;
    /**
     * @param queryIndex - The index of the query in the query set.
     */
    beginOcclusionQuery(queryIndex: GPUSize32): void;
    /**
     */
    endOcclusionQuery(): void;
    /**
     * Sets the current {@link GPURenderPipeline}.
     * @param pipeline - The render pipeline to use for subsequent drawing commands.
     */
    setPipeline(pipeline: REVRenderPipeline): void;
    /**
     * Sets the current index buffer.
     * @param buffer - Buffer containing index data to use for subsequent drawing commands.
     * @param indexFormat - Format of the index data contained in `buffer`.
     * @param offset - Offset in bytes into `buffer` where the index data begins. Defaults to `0`.
     * @param size - Size in bytes of the index data in `buffer`.
     * 	Defaults to the size of the buffer minus the offset.
     */
    setIndexBuffer(buffer: REVBuffer, indexFormat: GPUIndexFormat, offset?: GPUSize64, size?: GPUSize64): void;
    /**
     * Sets the current vertex buffer for the given slot.
     * @param slot - The vertex buffer slot to set the vertex buffer for.
     * @param buffer - Buffer containing vertex data to use for subsequent drawing commands.
     * @param offset - Offset in bytes into `buffer` where the vertex data begins. Defaults to `0`.
     * @param size - Size in bytes of the vertex data in `buffer`.
     * 	Defaults to the size of the buffer minus the offset.
     */
    setVertexBuffer(slot: GPUIndex32, buffer: REVBuffer | null, offset?: GPUSize64, size?: GPUSize64): void;
    /**
     * Draws primitives.
     * See [[#rendering-operations]] for the detailed specification.
     * @param vertexCount - The number of vertices to draw.
     * @param instanceCount - The number of instances to draw.
     * @param firstVertex - Offset into the vertex buffers, in vertices, to begin drawing from.
     * @param firstInstance - First instance to draw.
     */
    draw(vertexCount: GPUSize32, instanceCount?: GPUSize32, firstVertex?: GPUSize32, firstInstance?: GPUSize32): void;
    /**
     * Draws indexed primitives.
     * See [[#rendering-operations]] for the detailed specification.
     * @param indexCount - The number of indices to draw.
     * @param instanceCount - The number of instances to draw.
     * @param firstIndex - Offset into the index buffer, in indices, begin drawing from.
     * @param baseVertex - Added to each index value before indexing into the vertex buffers.
     * @param firstInstance - First instance to draw.
     */
    drawIndexed(indexCount: GPUSize32, instanceCount?: GPUSize32, firstIndex?: GPUSize32, baseVertex?: GPUSignedOffset32, firstInstance?: GPUSize32): void;

    /**
     * Sets the current {@link GPUBindGroup} for the given index.
     * @param index - The index to set the bind group at.
     * @param bindGroup - Bind group to use for subsequent render or compute commands.
     * 	<!--The overload appears to be confusing bikeshed, and it ends up expecting this to
     * 	define the arguments for the 5-arg variant of the method, despite the "for"
     * 	explicitly pointing at the 3-arg variant. See
     * @param https - //github.com/plinss/widlparser/issues/56 and
     * @param https - //github.com/tabatkins/bikeshed/issues/1740 -->
     * @param dynamicOffsets - Array containing buffer offsets in bytes for each entry in
     * 	`bindGroup` marked as {@link GPUBindGroupLayoutEntry#buffer}.{@link GPUBufferBindingLayout#hasDynamicOffset}.-->
     */
    setBindGroup(
        index: GPUIndex32,
        bindGroup: REVBindGroup | null,
        dynamicOffsets?: Iterable<GPUBufferDynamicOffset>
    ): undefined;

    /**
     * Sets the current {@link GPUBindGroup} for the given index, specifying dynamic offsets as a subset
     * of a {@link Uint32Array}.
     * @param index - The index to set the bind group at.
     * @param bindGroup - Bind group to use for subsequent render or compute commands.
     * @param dynamicOffsetsData - Array containing buffer offsets in bytes for each entry in
     * 	`bindGroup` marked as {@link GPUBindGroupLayoutEntry#buffer}.{@link GPUBufferBindingLayout#hasDynamicOffset}.
     * @param dynamicOffsetsDataStart - Offset in elements into `dynamicOffsetsData` where the
     * 	buffer offset data begins.
     * @param dynamicOffsetsDataLength - Number of buffer offsets to read from `dynamicOffsetsData`.
     */
    setBindGroup(
        index: GPUIndex32,
        bindGroup: REVBindGroup | null,
        dynamicOffsetsData: Uint32Array,
        dynamicOffsetsDataStart: GPUSize64,
        dynamicOffsetsDataLength: GPUSize32
    ): undefined;

    /**
     * Completes recording of the render pass commands sequence.
     */
    end(): undefined;
}

/** {@link GPUCommandEncoder} */
interface REVCommandEncoder {
    /**
     * Begins encoding a render pass described by `descriptor`.
     * @param descriptor - Description of the {@link GPURenderPassEncoder} to create.
     */
    beginRenderPass: (descriptor: REVRenderPassDescriptor) => REVRenderPassEncoder;
    /**
     * Encode a command into the {@link GPUCommandEncoder} that copies data from a sub-region of one
     * or multiple contiguous texture subresources to another sub-region of one or
     * multiple continuous texture subresources.
     * @param source - Combined with `copySize`, defines the region of the source texture subresources.
     * @param destination - Combined with `copySize`, defines the region of the destination texture subresources.
     * 	`copySize`:
     */
    copyTextureToTexture: (source: REVImageCopyTexture, destination: REVImageCopyTexture, copySize: GPUExtent3DStrict) => void;
    /**
     * Completes recording of the commands sequence and returns a corresponding {@link GPUCommandBuffer}.
     * 	descriptor:
     */
    finish: (descriptor?: GPUObjectDescriptorBase) => REVCommandBuffer;
}

/**
 * {@link GPUDevice}
 */
interface REVDevice {
    readonly limits: {
        readonly maxTextureDimension2D            : number,
        readonly maxTextureArrayLayers            : number,
        readonly maxSamplersPerShaderStage        : number,
        readonly maxUniformBuffersPerShaderStage  : number,
        readonly maxColorAttachmentBytesPerSample : number,
    }

    readonly features: GPUSupportedFeatures;

    /**
     * Creates a {@link GPUBuffer}.
     * @param descriptor - Description of the {@link GPUBuffer} to create.
     */
    createBuffer(descriptor: GPUBufferDescriptor): REVBuffer;
    /**
     * Creates a {@link GPUTexture}.
     * @param descriptor - Description of the {@link GPUTexture} to create.
     *
     * Specify glArray for WebGL2 support.
     */
    createTexture(descriptor: GPUTextureDescriptor & { glArray?: boolean, glCubemap?: boolean }): REVTexture;
    /**
     * Creates a {@link GPUSampler}.
     * @param descriptor - Description of the {@link GPUSampler} to create.
     */
    createSampler(descriptor?: GPUSamplerDescriptor): REVSampler;
    /**
     * Creates a {@link GPUBindGroupLayout}.
     * @param descriptor - Description of the {@link GPUBindGroupLayout} to create.
     */
    createBindGroupLayout(descriptor: GPUBindGroupLayoutDescriptor): REVBindGroupLayout;
    /**
     * Creates a {@link GPUPipelineLayout}.
     * @param descriptor - Description of the {@link GPUPipelineLayout} to create.
     */
    createPipelineLayout(descriptor: REVPipelineLayoutDescriptor): REVPipelineLayout;
    /**
     * Creates a {@link GPUBindGroup}.
     * @param descriptor - Description of the {@link GPUBindGroup} to create.
     */
    createBindGroup(descriptor: REVBindGroupDescriptor): REVBindGroup;
    /**
     * Creates a {@link GPUShaderModule}.
     * @param descriptor - Description of the {@link GPUShaderModule} to create.
     *
     * Specify glType for WebGL2 support.
     */
    createShaderModule(descriptor: REVShaderModuleDescriptor & { glType?: GL['VERTEX_SHADER'] | GL['FRAGMENT_SHADER'] }): REVShaderModule;
    /**
     * Creates a {@link GPURenderPipeline} using immediate pipeline creation.
     * @param descriptor - Description of the {@link GPURenderPipeline} to create.
     */
    createRenderPipeline(descriptor: REVRenderPipelineDescriptor): REVRenderPipeline;
    /**
     * Creates a {@link GPURenderPipeline} using async pipeline creation.
     * The returned {@link Promise} resolves when the created pipeline
     * is ready to be used without additional delay.
     * If pipeline creation fails, the returned {@link Promise} rejects with an {@link GPUPipelineError}.
     * Note: Use of this method is preferred whenever possible, as it prevents blocking the
     * queue timeline work on pipeline compilation.
     * @param descriptor - Description of the {@link GPURenderPipeline} to create.
     */
    createRenderPipelineAsync(descriptor: REVRenderPipelineDescriptor): Promise<REVRenderPipeline>;
    /**
     * Creates a {@link GPUQuerySet}.
     * @param descriptor - Description of the {@link GPUQuerySet} to create.
     */
    createQuerySet(descriptor: GPUQuerySetDescriptor): REVQuerySet;
    /**
     * Destroys the device, preventing further operations on it.
     * Outstanding asynchronous operations will fail.
     * Note: It is valid to destroy a device multiple times.
     */
    destroy(): void;

    readonly queue: {
        /**
         * Issues a write operation of the provided data into a {@link GPUBuffer}.
         * @param buffer - The buffer to write to.
         * @param bufferOffset - Offset in bytes into `buffer` to begin writing at.
         * @param data - Data to write into `buffer`.
         * @param dataOffset - Offset in into `data` to begin writing from. Given in elements if
         * 	`data` is a `TypedArray` and bytes otherwise.
         * @param size - Size of content to write from `data` to `buffer`. Given in elements if
         * 	`data` is a `TypedArray` and bytes otherwise.
         */
        writeBuffer(
            buffer: REVBuffer,
            bufferOffset: GPUSize64,
            data:
                | BufferSource
                | SharedArrayBuffer,
            dataOffset?: GPUSize64,
            size?: GPUSize64
        ): void;

        /**
         * Issues a write operation of the provided data into a {@link GPUTexture}.
         * @param destination - The texture subresource and origin to write to.
         * @param data - Data to write into `destination`.
         * @param dataLayout - Layout of the content in `data`.
         * @param size - Extents of the content to write from `data` to `destination`.
         */
        writeTexture(
            destination: REVImageCopyTexture,
            data:
                ImageBitmapSource | HTMLCanvasElement | OffscreenCanvas | BufferSource | SharedArrayBuffer |
                Uint8Array<ArrayBufferLike> |
                Int8Array<ArrayBufferLike> |
                Int16Array<ArrayBufferLike> |
                Uint16Array<ArrayBufferLike> |
                Uint32Array<ArrayBufferLike> |
                Float32Array<ArrayBufferLike> |
                Uint8ClampedArray<ArrayBuffer> |
                Int32Array<ArrayBuffer> |
                Float64Array<ArrayBuffer>,
            dataLayout: GPUImageDataLayout,
            size: GPUExtent3DStrict
        ): void;

        /**
         * Issues a copy operation of the contents of a platform image/canvas
         * into the destination texture.
         * This operation performs [[#color-space-conversions|color encoding]] into the destination
         * encoding according to the parameters of {@link GPUImageCopyTextureTagged}.
         * Copying into a `-srgb` texture results in the same texture bytes, not the same decoded
         * values, as copying into the corresponding non-`-srgb` format.
         * Thus, after a copy operation, sampling the destination texture has
         * different results depending on whether its format is `-srgb`, all else unchanged.
         * <!-- POSTV1(srgb-linear): If added, explain here how it interacts. -->
         * @param source - source image and origin to copy to `destination`.
         * @param destination - The texture subresource and origin to write to, and its encoding metadata.
         * @param copySize - Extents of the content to write from `source` to `destination`.
         */
        copyExternalImageToTexture(
            source: GPUImageCopyExternalImage,
            destination: Override<GPUImageCopyTextureTagged, { texture: REVTexture }>,
            copySize: GPUExtent3DStrict
        ): void;

        /**
         * Schedules the execution of the command buffers by the GPU on this queue.
         * Submitted command buffers cannot be used again.
         * 	`commandBuffers`:
         */
        submit(commandBuffers: Iterable<REVCommandBuffer>): void;
    }
}

type REVDeviceExtended = {
    /**
     * Creates a {@link GPUCommandEncoder}.
     * @param descriptor - Description of the {@link GPUCommandEncoder} to create.
     */
    createCommandEncoder(descriptor?: GPUCommandEncoderDescriptor): REVCommandEncoder;
}

export declare abstract class RevGAL<C extends { canvas: HTMLCanvasElement|OffscreenCanvas } = any, D extends REVDevice = REVDevice> {
    context:            C;
    device:             D & REVDeviceExtended;
    api:                'webgpu'|'webgl2';
    language:           'wgsl'|'glsl';
    ndcZO:              boolean;
    presentationFormat: GPUTextureFormat;

    readonly limits:    D['limits'];

    constructor(options: { context: C, device: D, api: 'webgpu'|'webgl2', language: 'wgsl'|'glsl', ndcZO: boolean, presentationFormat: GPUTextureFormat });

    reconfigure(): void;

    /**
     * Destroys the device and any associated resources
     */
    destroy(): void;

    getContextView(): ReturnType<ReturnType<D['createTexture']>['createView']>;

    /**
     * Convenience method for creating a buffer from pre existing data
     */
    createBufferWithData(options: { data: TypedArray, size?: number } & Omit<GPUBufferDescriptor, 'size'>): ReturnType<D['createBuffer']>;

    /**
     * Convenience method for creating a texture from pre existing data
     */
    createTextureWithData(options: { data: ImageBitmapSource|HTMLCanvasElement|OffscreenCanvas|BufferSource|SharedArrayBuffer, glCubemap?: boolean, glArray?: boolean } & GPUTextureDescriptor): ReturnType<D['createTexture']>;

    /**
     * Convenience method for creating a texture from Image bitmap
     */
    createTextureFromImageBitmapData(options: { data: ImageBitmapSource, glCubemap?: boolean, glArray?: boolean } & GPUTextureDescriptor): ReturnType<D['createTexture']>;

    /**
     * Gets a texture for a given gltf texture from the cache or creates it if it does not already exist.
     */
    getTextureFromGLTF(gltfTexture: Texture): { texture: ReturnType<D['createTexture']>, sampler: ReturnType<D['createSampler']>, loaded: Promise<void> };

    /**
     * Creates a texture for a given gltf texture.
     * @see https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html#_filtering
     */
    createTextureFromGLTF(gltfTexture: Texture): { texture: ReturnType<D['createTexture']>, sampler: ReturnType<D['createSampler']>, loaded: Promise<void> };

    /**
     * Generates a set of vertex and fragment shader modules. Will retrieve from cache or create if it does not already exists.
     */
    generateShaders<T extends ShaderConstructor>(shaderConstructor: T, input: ShaderInitialized<InstanceType<T>>): { stages: { vertex: ReturnType<D['createShaderModule']>, fragment: ReturnType<D['createShaderModule']> }, source: { vertex: string, fragment: string } }

    /**
     * Clears the shader cache
     */
    clearShaderCache(): void;

    /**
     * Creates a render pipeline from cache
     */
    createPipelineFromCache(options: { cacheKey: string, descriptor: Parameters<D['createRenderPipeline']>[0] }): ReturnType<D['createRenderPipeline']>;

    /**
     * Creates a render pipeline from cache asynchronously
     */
    createPipelineFromCacheAsync(options: { cacheKey: string, descriptor: Parameters<D['createRenderPipelineAsync']>[0] }): ReturnType<D['createRenderPipelineAsync']>;

    /**
     * Resolves an occlusion query set
     */
    resolveOcclusionQuerySet(querySet: ReturnType<D['createQuerySet']>): Promise<BigInt64Array>;

    /**
     * Reads a texture into an ArrayBuffer
     */
    readTexture(texture: ReturnType<D['createTexture']>, options?: { origin?: GPUOrigin3D, size?: GPUExtent3DDict, mipLevel?: number }): Promise<ArrayBuffer>

    /**
     * Creates a function to resolve a multisampled depth attachment
     */
    createDepthTextureResolver?(attachment: DepthAttachment): (commandEncoder: ReturnType<D['createCommandEncoder']>) => void;

    /**
     * Creates a function to generate mipmaps for a texture
     */
    createMipmapGenerator(texture:  ReturnType<D['createTexture']>, viewDimension?: GPUTextureViewDimension): (commandEncoder: ReturnType<D['createCommandEncoder']>) => void;

    /**
     * Returns true if target is GPUCanvasContext or WebGL2RenderingContext
     */
    static isRenderingContext(target: any): target is (GPUCanvasContext | WebGL2RenderingContext)

    /**
     * Returns true if target is GPUCanvasContext
     */
    static isGPUContext(target: any): target is (GPUCanvasContext)

    /**
     * Returns true if target is WebGL2RenderingContext
     */
    static isGL2Context(target: any): target is (WebGL2RenderingContext)

    /**
     *Returns true if target is HTMLCanvasElement or OffscreenCanvas
     */
    static isCanvas(target: any): target is (HTMLCanvasElement | OffscreenCanvas)

    requestAnimationFrame(callback: FrameRequestCallback): number;
    cancelAnimationFrame(handle: number): void;
}
