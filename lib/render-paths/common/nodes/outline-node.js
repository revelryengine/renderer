import { ColorAttachment, DepthAttachment, RenderNode } from '../../render-node.js';

import { GLTFNode       } from './gltf-node.js';
import { GLTFShader     } from '../shaders/gltf-shader.js';
import { OutlineShader  } from '../shaders/outline-shader.js';
import { ResampleShader } from '../shaders/resample-shader.js';

import { NonNull } from '../../../../deps/utils.js';

class OutlineGLTFShader extends GLTFShader {
    getFlags() {
        const flags = super.getFlags();
        return {
            ...flags,

            useShadows:      false,
            usePunctual:     false,
            useEnvironment:  false,
            useTransmission: false,
            useSSAO:         false,
            useFog:          false,

            isBlend: false,
            depthWriteEnabled: true,

            colorTargets: {
                id: true,
            },
        }
    }
}

class OutlineGLTFNode extends GLTFNode {
    Shader = OutlineGLTFShader;

    /**
     * @param {import('../../render-path.js').RenderPath} renderPath
     */
    constructor(renderPath) {
        super(renderPath);

        this.enableAttachments('id', 'depth');
    }

    getBindGroupEntries( ){
        return null;
    }

    /**
     * @type {GLTFNode['render']}
     */
    render(renderPassEncoder) {
        super.render(renderPassEncoder);
        this.renderOutline(renderPassEncoder);
    }

    /**
     * @type {GLTFNode['render']}
     */
    renderOutline(renderPassEncoder) {
        const { instances } = this.passData;

        for(const batch of instances.outline.batches) {
            this.renderBlock(renderPassEncoder, instances.outline.buffer, batch);
        }
    }
}

class OutlineExtractNode extends RenderNode {

    attachments = {
        colors: {
            color: new ColorAttachment(),
        },
    }

    /**
     * @param {{ id: ColorAttachment<'r32uint'>, depth: DepthAttachment }} config
     */
    reconfigure({ id, depth }) {
        super.reconfigure();

        NonNull(this.renderPassDescriptor).depthStencilAttachment = {
            view:            NonNull(depth.unresolved ?? depth.texture).createView(),
            glResolveTarget: (depth.unresolved && NonNull(depth.texture).createView()) ?? undefined,
            depthStoreOp:    'store',
            depthLoadOp:     'load',
        }

        const view = NonNull(id.texture).createView({ format: id.texture?.format });

        this.outlineShader = new OutlineShader(this.gal, { view }).compile();
    }

    /**
     * @type {RenderNode['render']}
     */
    render(renderPassEncoder) {
        const { graph } = this.passData;
        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        this.outlineShader?.run(renderPassEncoder);
    }
}

/**
 * The Outline Node is responsible for outlining game objects.
 */
export class OutlineNode extends RenderNode {
    /**
     * @type {import('../../../revgal.js').REVTextureView|null}
     */
    #colorView = null;

    attachments = {
        colors: {
            color: new ColorAttachment(),
        },
    }

    gltfNode    = new OutlineGLTFNode(this.renderPath);
    extractNode = new OutlineExtractNode(this.renderPath);

    /**
     * @param {{ color: ColorAttachment<'rgba8unorm'> }} config
     */
    reconfigure({ color }) {
        super.reconfigure();

        this.gltfNode.reconfigure();

        this.extractNode.reconfigure(/** @type {Required<GLTFNode['output']>} */(this.gltfNode.output));

        const texture = NonNull(this.extractNode.output.color?.texture);

        this.blendShader = new ResampleShader(this.gal,  { label: 'OutlineBlend', view: texture.createView(), format: texture.format, blend: /** @type {const} */({
            color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
            },
            alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
            }
        }) }).compile();

        this.#colorView = NonNull(color.texture).createView();

        return { color };
    }


    /**
     * @type {RenderNode['begin']}
     */
    begin(commandEncoder) {
        return commandEncoder.beginRenderPass({
            label: this.constructor.name,
            colorAttachments: [{
                view:    NonNull(this.#colorView),
                storeOp: 'store',
                loadOp:  'load',
            }],
        });
    }

    /**
     * @type {RenderNode['run']}
     */
    run(commandEncoder) {
        this.gltfNode.run(commandEncoder);
        this.extractNode.run(commandEncoder);
        super.run(commandEncoder);
    }

    /**
     * @type {RenderNode['render']}
     */
    render(renderPassEncoder) {
        const { graph } = this.passData;
        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        this.blendShader?.run(renderPassEncoder);
    }
}
