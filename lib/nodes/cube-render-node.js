import { TEXTURE_USAGE } from '../constants.js';
import { RenderNode } from './render-node.js';

/**
 * A CubeRenderNode is similar to a RenderNode but it creates all attachments as cubemaps and will run once for each cube face
 * Does not support depthStencil attachments
 */
export class CubeRenderNode extends RenderNode {
    #width;
    #height;
    resize() {
        const { gal } = this.renderPath;
        const { colors = [] } = this.attachments;
        const { width, height } = this.getTargetSize();

        if(width === this.#width && height === this.#height) return; //no resize needed

        this.renderPassDescriptors = [];
        for(const color of colors) {
            color.texture?.destroy();

            const { format, mipLevelCount } = { ...RenderNode.DEFAULT_COLOR_PARAMS, ...color };
        
            color.texture = gal.device.createTexture({
                size:  { width, height, depthOrArrayLayers: 6, ...this.size },
                cubemap: true,
                format,
                mipLevelCount,
                usage: TEXTURE_USAGE.RENDER_ATTACHMENT | TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_SRC,
            });
        }

        for(let face = 0; face < 6; face++) {
            const renderPassDescriptor = {
                label: `Node: ${this.constructor.name}`,
                colorAttachments: [],
            }

            for(const color of colors) {
                const { loadValue } = { ...RenderNode.DEFAULT_COLOR_PARAMS, ...color };

                renderPassDescriptor.colorAttachments.push({
                    view: color.texture.createView({ dimension: '2d', baseArrayLayer: face }),
                    loadValue,
                });
            }

            this.renderPassDescriptors[face] = renderPassDescriptor;
        }
        
        this.#width  = width;
        this.#height = height;
    }

    begin(commandEncoder, face) {
        return commandEncoder.beginRenderPass(this.renderPassDescriptors[face]);
    }

    render(renderPassEncoder) {
        //run programs
    }

    end(renderPassEncoder) {
        renderPassEncoder.endPass();
    }

    run(commandEncoder, ...args) {
        for(let face = 0; face < 6; face++){
            const renderPassEncoder = this.begin(commandEncoder, face, ...args);
            this.render(renderPassEncoder, face, ...args);
            this.end(renderPassEncoder, face, ...args);
        }
    }
}

export default CubeRenderNode;