import { RenderNode } from '../../render-node.js';

import { GLTFNode       } from './gltf-node.js';
import { GLTFShader     } from '../shaders/gltf-shader.js';
import { OutlineShader  } from '../shaders/outline-shader.js';
import { ResampleShader } from '../shaders/resample-shader.js';


class OutlineGLTFShader extends GLTFShader {
    getFlags(...args) {
        const flags = super.getFlags(...args);
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

    attachments = {
        colors: { id: this.attachments.colors.id },
        depth:  { },
    }

    reconfigure() {
        this.bindGroupLayout = this.gal.device.createBindGroupLayout({
            label: this.constructor.name,
            entries: [],
        });

        this.bindGroup = this.gal.device.createBindGroup({
            label: this.constructor.name,
            layout: this.bindGroupLayout,
            entries: []
        });

        super.reconfigure();
    }

    render(renderPassEncoder, { graph, frustum, instances }) {

        super.render(renderPassEncoder, { graph, frustum, instances });

        this.renderOutline(renderPassEncoder, { graph, instances });
    }

    renderOutline(renderPassEncoder, { graph, instances }) {
        for(const batch of instances.outline.batches) {
            this.renderBlock(renderPassEncoder, graph, instances.outline.buffer, batch);
        }
    }
}

class OutlineExtractNode extends RenderNode {
    attachments = {
        colors: {
            color: { location: 0 },
        },
    }

    reconfigure({ id, depth }) {
        super.reconfigure();

        this.renderPassDescriptors[0].depthStencilAttachment = {
            view: (depth.unresolved ?? depth.texture).createView(),
            glResolveTarget: depth.unresolved && depth.texture.createView(),
            depthStoreOp: 'store',
            depthLoadOp: 'load',
        }

        const view   = id.texture.createView({ format: id.texture.format });

        this.outlineShader = new OutlineShader(this.gal, { label: 'OutlineNode', view }).compile();
    }

    render(renderPassEncoder, { graph }) {
        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        this.outlineShader.run(renderPassEncoder);
    }
}

/**
 * The Outline Node is responsible for outlining game objects.
 */
export class OutlineNode extends RenderNode {
    #colorView;

    attachments = {
        colors: {
            color: { location: 0 },
        },
    }

    gltfNode    = new OutlineGLTFNode(this.renderPath);
    extractNode = new OutlineExtractNode(this.renderPath);

    reconfigure({ color }) {
        super.reconfigure();

        this.gltfNode.reconfigure();

        this.extractNode.reconfigure(this.gltfNode.output);

        const { texture } = this.extractNode.output.color;

        this.blendShader = new ResampleShader(this.gal,  { label: 'OutlineBlend', view: texture.createView(), format: texture.format, blend: {
            color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
            },
            alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
            }
        } }).compile();

        this.#colorView = color.texture.createView();

        return { color };
    }


    begin(commandEncoder) {
        return commandEncoder.beginRenderPass({
            label: this.constructor.name,
            colorAttachments: [{
                view:    this.#colorView,
                storeOp: 'store',
                loadOp:  'load',
            }],
        });
    }

    run(...args) {
        this.gltfNode.run(...args);
        this.extractNode.run(...args);
        super.run(...args);
    }

    render(renderPassEncoder, { graph }) {
        renderPassEncoder.setBindGroup(0, graph.bindGroup);
        this.blendShader.run(renderPassEncoder);
    }
}

export default OutlineNode;
