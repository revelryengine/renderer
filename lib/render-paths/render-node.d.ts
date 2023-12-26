import { DEFAULT_COLOR_PARAMS, DEFAULT_DEPTH_PARAMS, TEXTURE_USAGE } from '../constants.js';
import { Graph } from '../graph.js';
import { REVCommandEncoder, REVRenderPassEncoder, RevGAL } from '../revgal.js';
import { RenderPath } from './render-path.js';


type ColorAttachment = {
    enabled?:    boolean,
    format?:     GPUTextureFormat,
    storeOp?:    GPUStoreOp,
    loadOp?:     GPULoadOp,
    clearValue?: GPUColor,
}

type DepthAttachment = {
    enabled?:         boolean,
    format:           GPUTextureFormat,
    depthClearValue?: number,
    depthStoreOp?:    GPUStoreOp,
    depthLoadOp?:     GPULoadOp,
}

export declare class RenderNode<A extends { colors?: Record<string, ColorAttachment>, depth: DepthAttachment } = any> {
    constructor(renderPath: RenderPath);

    attachments: A;
    connections: {};
    output     : {};
    size       : {};

    scaleFactor: number;

    readonly renderPath: RenderPath
    readonly gal: RevGAL;
    readonly settings: RenderPath['settings']
    getConnectionValue<T extends keyof this['connections']>(name: T): never

    getTargetSize(): { width: number, height: number }

    hasEnabledAttachments(): boolean;
    getHighestAttachmentLocation(): number;

    initAttachments(): void;
    reconfigure(): void;

    render(): void;

    begin(commandEncoder: REVCommandEncoder, options?: unknown): REVRenderPassEncoder;
    run(commandEncoder: REVCommandEncoder, options: { graph: import('../graph.js').Graph, frustum: import('../frustum.js').Frustum, instances: ReturnType<import('../graph.js').Graph['generateInstances']> }): void
    end(renderPassEncoder: REVRenderPassEncoder): void

    destroy(): void

    precompile(graph: Graph): Promise<void>;
}

/**
 * A CubeRenderNode is similar to a RenderNode but it creates all attachments as cubemaps and will run once for each cube face
 * Does not support depthStencil attachments
 */
export class CubeRenderNode extends RenderNode {
    begin(commandEncoder: REVCommandEncoder, face: number): REVRenderPassEncoder;
}
