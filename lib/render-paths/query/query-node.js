import { GLTFNode   } from '../common/nodes/gltf-node.js';
import { GLTFShader } from '../common/shaders/gltf-shader.js';

import { NonNull } from '../../../deps/utils.js';

class GLTFQueryShader extends GLTFShader {
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

            colorTargets: {
                id:    true,
                point: true,
            },
        }
    }
}

class GLTFQueryShaderNoDepthTest extends GLTFQueryShader {
    getFlags() {

        const flags = super.getFlags();
        return {
            ...flags,
            depthWriteEnabled: false
        }
    }
}

/**
 * The query node is responsible for rendering all game objects with queries to see if they were rendered.
 *
 * @extends {GLTFNode<{
 *  output: {
 *      query: {
 *         mode:  'point',
 *         point: [number, number],
 *      } | {
 *         mode: 'bounds',
 *         min:  [number, number],
 *         max:  [number, number],
 *         gameObjects: string[],
 *         occlusionQuerySet: import('../../revgal.js').REVQuerySet,
 *      }
 *  },
 *  settings: import('./query-settings.js').QuerySettings,
 * }>}
 */
export class QueryNode extends GLTFNode {
    Shader = GLTFQueryShader;

    opaque       = true;
    transmissive = true;
    alpha        = true;

    /**
     * @param {import('../render-path.js').RenderPath} renderPath
     */
    constructor(renderPath) {
        super(renderPath);

        this.enableAttachments('id', 'point', 'depth');
    }

    // scaleFactor = 0.5;

    getBindGroupEntries( ){
        return null;
    }

    /**
     * @type {GLTFNode['begin']}
     *
     */
    begin(commandEncoder) {
        const { instances } = this.passData;

        const { mode } = this.settings.flags;
        const { point, min, max } = this.settings.values;

        if(mode === 'bounds') {
            this.output.query = {
                mode: 'bounds',
                min: [min[0], min[1]],
                max: [max[0], max[1]],
                gameObjects: /** @type {string[]} */([]),
                occlusionQuerySet: this.gal.device.createQuerySet({ type: 'occlusion', count: Math.min(Object.keys(instances.gameObjects).length, 4096) }),
            }

            return commandEncoder.beginRenderPass({
                ...NonNull(this.renderPassDescriptor),
                occlusionQuerySet: this.output.query.occlusionQuerySet,
            });
        } else {
            this.output.query = {
                mode: 'point',
                point: [point[0], point[1]],
            }
            return super.begin(commandEncoder);
        }
    }

    /**
     * @type {GLTFNode['getShader']}
     */
    getShader(...args) {
        return super.getShaderSync(...args);
    }

    /**
     * @type {GLTFNode['render']}
     */
    render(renderPassEncoder) {
        const { graph, frustum, instances } = this.passData;

        const [,,width, height] = frustum.uniformViewport;

        const { mode } = this.output.query;
        const { min, max } = this.settings.values;

        if(mode === 'bounds') {
            renderPassEncoder.setScissorRect(min[0] * width, min[1] * height, (max[0] - min[0]) * width, (max[1] - min[1]) * height);

            renderPassEncoder.setBindGroup(0, graph.bindGroup);
            renderPassEncoder.setBindGroup(1, frustum.bindGroup);
            renderPassEncoder.setBindGroup(2, this.bindGroup);

            let i = 0;
            for(const [gameObjectId, blocks] of Object.entries(instances.gameObjects)) {
                this.output.query.gameObjects[i] = gameObjectId;

                renderPassEncoder.beginOcclusionQuery(i);

                for(const { buffer, offset, primitive, frontFace } of blocks) {
                    const material = graph.getActiveMaterial(primitive);
                    const shader   = this.getShaderSync({ primitive, material, frontFace, Shader: GLTFQueryShaderNoDepthTest });
                    shader.run(renderPassEncoder, { buffer, offset, count: 1 });
                }

                renderPassEncoder.endOcclusionQuery();

                if(++i > 4096) break;
            }
        } else {
            // renderPassEncoder.setScissorRect(point[0] * width - 1, point[1] * height - 1, 3, 3);
            super.render(renderPassEncoder);
        }
    }
}

