import { ColorAttachment, DepthAttachment, RenderNode } from '../../render-node.js';

/**
 * @typedef {{ color: ColorAttachment<'rgba8unorm'>, depth: DepthAttachment<'depth24plus'>, motion: ColorAttachment<'rg16float'> }} PostNodeConfig
 */

/**
 *
 * @template {{ input?: Record<string, any>, output?: Record<string, any> }} [I={}]
 * @template {{ colors?: Record<string, ColorAttachment>, depth?: DepthAttachment }} [A={}]
 * @typedef {Omit<RenderNode<I, A>, 'reconfigure'> & { reconfigure: (config: PostNodeConfig) => Partial<PostNodeConfig>}} PostNodeChild
 */

/**
 * The Post Node is responsible for running all post process nodes.
 *
 * @extends {RenderNode<{
 *  input: {
 *      color:  ColorAttachment<'rgba8unorm'>,
 *      depth:  DepthAttachment<'depth24plus'>,
 *      motion: ColorAttachment<'rg16float'>,
 *  },
 *  output: {
 *      color:  ColorAttachment<'rgba8unorm'>,
 *      depth:  DepthAttachment<'depth24plus'>,
 *      motion: ColorAttachment<'rg16float'>,
 *  },
 *  settings: import('../../render-path-settings.js').RenderPathSettings,
 * }>}
 */
export class PostNode extends RenderNode {
    /**
     * @param {ConstructorParameters<typeof RenderNode>[0]} renderPath
     * @param {PostNodeChild[]} children
     */
    constructor(renderPath, children) {
        super(renderPath);
        this.children = children;
    }

    reconfigure() {
        let color  = this.input['color'];
        let depth  = this.input['depth'];
        let motion = this.input['motion'];

        for(const child of this.children) {
            ({ color = color, depth = depth, motion = motion } = child.reconfigure({ color, depth, motion }) ?? {});
        }

        this.output.color = color;
    }

    reconfigureNodePaths() {

    }

    /**
     * @type {RenderNode['run']}
     */
    run(commandEncoder) {
        for(const child of this.children) {
            child.run(commandEncoder);
        }
    }

    /**
     * @type {RenderNode['precompile']}
     */
    async precompile(graph) {
        await Promise.all(this.children.map(child => child.precompile(graph)));
    }
}
