import { Graph      } from '../graph.js';
import { Frustum    } from '../frustum.js';
import { RevGAL     } from '../revgal.js';
import { RenderNode } from './render-node.js';
import { RenderPathSettings } from './render-path-settings.js';

type RenderPathConstructor<K extends keyof Revelry.Renderer.RenderPaths> = new (...args: any[]) => Revelry.Renderer.RenderPaths[K];

type RenderPassData = { graph: Graph, frustum: Frustum, instances: ReturnType<Graph['generateInstances']> };

export declare abstract class RenderPath<T extends { nodes?: Record<string, RenderNode>, preNodes?: Record<string, RenderNode> } = {}> {
    settings:  RenderPathSettings;

    nodes:     T['nodes'];
    path:      RenderNode[];
    preNodes:  T['preNodes'];
    prePath:   RenderNode[];

    constructor(gal: RevGAL)

    readonly gal: RevGAL;
    width:  number;
    height: number;

    reconfigure(flags?: Parameters<this['settings']['reconfigure']>[0], values?: Parameters<this['settings']['reconfigure']>[1]): void;
    reconfigureNodePath(): void;

    connect<S extends RenderNode, D extends RenderNode>(src: S|null|undefined, dst: D|null|undefined, connections: RenderNodeConnections<S, D> ): void;
    disconnect<D extends RenderNode>(node: D|null|undefined, ...connections: (keyof D['input'] & string)[]): void;

    /**
     * Calculates the order of the nodes by working backwards from the output connections
     */
    calculateNodePath(): void;

    readonly passData: RenderPassData|null;
    run(data: RenderPassData): void;

    readonly output: RenderNode['output'] | undefined;

    static registry: { [K in keyof Revelry.Renderer.RenderPaths]: RenderPathConstructor<K> };
    static register<K extends keyof Revelry.Renderer.RenderPaths>(name: K, Constructor: RenderPathConstructor<K>): void;

    precompile(graph: Graph): Promise<void>;
    destroy(): void;
}
