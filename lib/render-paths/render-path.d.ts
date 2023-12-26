import { Graph } from '../graph.js';
import { RevGAL     } from '../revgal.js';
import { RenderNode } from './render-node.js';
import { RenderPathSettings } from './render-path-settings.js';

type RenderPaths = Revelry.Renderer.RenderPaths;

type RenderPathConstructor<T extends keyof Revelry.Renderer.RenderPaths = keyof Revelry.Renderer.RenderPaths> = {
    new (viewport: import('../viewport.js').Viewport): RenderPath<T>;
}

export declare abstract class RenderPath<T extends keyof Revelry.Renderer.RenderPaths = keyof Revelry.Renderer.RenderPaths> {
    settings:  RenderPathSettings;

    nodes:     Revelry.Renderer.RenderPaths[T]['nodes'] extends undefined ? Record<string, never> : Revelry.Renderer.RenderPaths[T]['nodes'];
    path:      RenderNode[];
    preNodes:  Revelry.Renderer.RenderPaths[T]['preNodes'] extends undefined ? Record<string, never> : Revelry.Renderer.RenderPaths[T]['preNodes'];
    prePath:   RenderNode[];

    constructor(viewport: import('../viewport.js').Viewport)

    readonly gal:    RevGAL;
    readonly width:  number;
    readonly height: number;

    reconfigure(flags?: Parameters<this['settings']['reconfigure']>[0], values?: Parameters<this['settings']['values']['set']>[0]): void;
    reconfigureNodes(): void;

    connect(src: RenderNode, dst: RenderNode, connections: Record<string, string>): void;
    disconnect(dst: RenderNode, connections: Record<string, string>): void;

    /**
     * Calculates the order of the nodes by working backwards from the output connections
     */
    calculateNodePath(): void;

    readonly output: RenderNode['output'] | undefined;

    static registry: { [K in keyof Revelry.Renderer.RenderPaths]: RenderPathConstructor<K> };
    static define<T extends keyof Revelry.Renderer.RenderPaths>(name: T, Constructor: RenderPathConstructor<T>): void;

    precompile(graph: Graph): Promise<void>;
    destroy(): void;
}
