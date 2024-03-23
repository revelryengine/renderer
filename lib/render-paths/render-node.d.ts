import { DEFAULT_COLOR_PARAMS, DEFAULT_DEPTH_PARAMS, TEXTURE_USAGE   } from '../constants.js';
import { REVCommandEncoder, REVRenderPassDescriptor, REVRenderPassEncoder, REVTexture, RevGAL } from '../revgal.js';
import { RenderPathSettings } from './render-path-settings.js';

import { RenderPassData, RenderPath } from './render-path.js';

declare class RenderAttachment<F extends GPUTextureFormat = any> {
    enabled:       boolean;
    format:        F;
    mipLevelCount: number;

    texture:    REVTexture|null;
    unresolved: REVTexture|null;

    constructor(options?: { enabled?: boolean, format?: F, mipLevelCount?: number });

    init(gal: RevGAL, options: { label: string, size: GPUExtent3DDict, sampleCount: number, glCubemap?: boolean }): void;
    destroy(): void;
}

export declare class ColorAttachment<F extends GPUTextureFormat = any> extends RenderAttachment<F>{
    storeOp:    GPUStoreOp;
    loadOp:     GPULoadOp;
    clearValue: GPUColor;

    constructor(options?: { enabled?: boolean, format?: F, storeOp?: GPUStoreOp, loadOp?: GPULoadOp, clearValue?: GPUColor, mipLevelCount?: number });
}

export declare class DepthAttachment<F extends GPUTextureFormat & `depth${string}` = any> extends RenderAttachment<F> {
    depthClearValue: number;
    depthStoreOp:    GPUStoreOp;
    depthLoadOp:     GPULoadOp;

    constructor(options?: { enabled?: boolean, format?: F,  depthStoreOp?: GPUStoreOp, depthLoadOp?: GPULoadOp, depthClearValue: number });
}


type RenderNodeConnections<O extends RenderNode, I extends RenderNode> = {
    [K in keyof O['output'] & string]?: keyof { [L in keyof I['input']]: I['input'][L] extends O['output'][K] ? L : never } & string
}

type RenderNodeDefinition = { input?: Record<string, any>, output?: Record<string, any>, settings?: RenderPath['settings'] };
type RenderNodeAttachmentDefinition = { colors?: Record<Exclude<string, 'depth'>, ColorAttachment>, depth?: DepthAttachment };

export declare class RenderNode<
    T extends RenderNodeDefinition = RenderNodeDefinition,
    A extends RenderNodeAttachmentDefinition = RenderNodeAttachmentDefinition,
> {
    constructor(renderPath: RenderPath);

    readonly attachments: A;

    readonly input:  Record<string, any> & T['input'];
    readonly output: Record<string, any> & T['output'] & ({ [K in keyof this['attachments']['colors']]: this['attachments']['colors'][K] } & { depth: this['attachments']['depth'] });

    readonly connections: Record<string, RenderNode>;

    size:         { width?: number, height?: number};
    scaleFactor:  number;
    sampleCount:  number;
    layers:       number;
    cubemap:      boolean;
    currentLayer: number;

    readonly renderPath: RenderPath
    readonly gal: RevGAL;
    readonly settings: RenderPathSettings & T['settings'];
    readonly renderPassDescriptor: REVRenderPassDescriptor|null;

    getTargetSize(): { width: number, height: number };

    initAttachments(): void;

    reconfigure(...args: any): void;

    get passData(): RenderPassData;

    run(commandEncoder: REVCommandEncoder, ...args?: any): void;
    begin(commandEncoder: REVCommandEncoder, ...args?: any): REVRenderPassEncoder;
    render(renderPassEncoder: REVRenderPassEncoder, ...args?: any): void;
    end(renderPassEncoder: REVRenderPassEncoder, ...args?: any): void;

    readonly destroyed: boolean;
    destroy(): void;

    precompile(graph: Graph): Promise<void>;

    setRenderLayer(layer: number): void;

    /**
     * Enables the specified attachments and disables all others
     */
    enableAttachments(...enabled: string[]): void;
}

/**
 * A CubeRenderNode is similar to a RenderNode but it creates all attachments as cubemaps and will run once for each cube face
 *
 *
 */
export class CubeRenderNode<
    T extends RenderNodeDefinition = RenderNodeDefinition,
    A extends RenderNodeAttachmentDefinition = RenderNodeAttachmentDefinition
> extends RenderNode<T, A> {
    layers  = 6;
    cubemap = true;
}
