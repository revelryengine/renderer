import { GLTFNode } from '../../common/nodes/gltf-node.js';
import { GLTFQueryShader, GLTFQueryShaderNoDepthTest } from '../shaders/gltf-query.js';

/**
 * The query node is responsible for rendering all game objects with queries to see if they were rendered. 
 */
export class QueryNode extends GLTFNode {
    Shader = GLTFQueryShader;

    opaque = true;
    transmissive = true;
    alpha = true;

    attachments = {
        colors: { id: this.attachments.colors.id, point: this.attachments.colors.point },
        depth:  { },
    }

    // scaleFactor = 0.5;

    reconfigure() {
        super.reconfigure();

        this.bindGroupLayout = this.gal.device.createBindGroupLayout({
            label: this.constructor.name,
            entries: [],
        });

        this.bindGroup = this.gal.device.createBindGroup({
            label: this.constructor.name,
            layout: this.bindGroupLayout,
            entries: []
        });
    }

    begin(commandEncoder, { graph, instances, point, bounds }) {
        if(bounds) {
            this.output.query = {
                bounds,
                graph,
                gameObjects: [],
                occlusionQuerySet: this.gal.device.createQuerySet({ type: 'occlusion', count: Math.min(Object.keys(instances.blocks.gameObjects).length, 4096) }),
            }
            
            return commandEncoder.beginRenderPass({
                ...this.renderPassDescriptors[0],
                occlusionQuerySet: this.output.query.occlusionQuerySet,
            });
        } else {
            this.output.query = {
                point,
                graph,
            }
            return super.begin(commandEncoder);
        }
    }

    getShader(...args) {
        return super.getShaderSync(...args);
    }

    render(renderPassEncoder, { graph, frustum, instances, point, bounds }) {
        const [,,width, height] = frustum.uniformViewport;
        
        if(bounds) {
            renderPassEncoder.setViewport(...frustum.uniformViewport);
            renderPassEncoder.setScissorRect(bounds.min[0] * width, bounds.min[1] * height, (bounds.max[0] - bounds.min[0]) * width, (bounds.max[1] - bounds.min[1]) * height);

            renderPassEncoder.setBindGroup(0, graph.bindGroup);
            renderPassEncoder.setBindGroup(1, frustum.bindGroup);
            renderPassEncoder.setBindGroup(2, this.bindGroup);

            const { buffer } = instances;

            let i = 0;
            for(const [gameObjectId, blocks] of Object.entries(instances.blocks.gameObjects)) {
                this.output.query.gameObjects[i] = gameObjectId;
                
                renderPassEncoder.beginOcclusionQuery(i);

                for(const { block, index } of blocks) {
                    const { primitive, mesh, skin, offset, frontFace } = block;
                    const material = graph.getActiveMaterial(primitive);
                    const shader   = this.getShaderSync({ primitive, mesh, material, skin, frontFace, Shader: GLTFQueryShaderNoDepthTest });
                    shader.run(renderPassEncoder, { buffer, offset: offset + index, count: 1 });
                }
                
                renderPassEncoder.endOcclusionQuery();

                if(++i > 4096) break;
            }
        } else {
            // renderPassEncoder.setViewport(...frustum.uniformViewport);
            // renderPassEncoder.setScissorRect(point.x * width - 1, point.y * height - 1, 3, 3);
            super.render(renderPassEncoder, { graph, frustum, instances });
        }
    }
}

export default QueryNode;