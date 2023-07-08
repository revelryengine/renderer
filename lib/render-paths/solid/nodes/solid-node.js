import { GLTFNode } from '../../common/nodes/gltf-node.js';
import { GLTFSolidShader } from '../shaders/gltf-solid.js';
/**
 * The Solid Node is responsible for rendering all glTF objects with solid shading. 
 */
export class SolidNode extends GLTFNode {
    Shader = GLTFSolidShader;

    opaque = true;
    transmissive = true;
    alpha = true;

    #lastSettings;
    reconfigure() {
        const { 
            temporal,
            msaa: { enabled: msaaEnabled, samples: msaaSamples },
            
        } = this.settings;

        const currentSettings = JSON.stringify({ temporal, msaaEnabled, msaaSamples });

        if(this.#lastSettings !== currentSettings) {
            this.#lastSettings = currentSettings;
            this.clearShaderCache();
            this.destroy(); // need this to make sure that the dynamically enabled textures gets created/destroyed

            this.attachments.colors.accum.enabled  = false;
            this.attachments.colors.reveal.enabled = false;

            this.attachments.colors.point.enabled  = false;
            this.attachments.colors.id.enabled     = false;
            this.attachments.colors.motion.enabled = temporal;
        }

        this.sampleCount = msaaEnabled ? msaaSamples : 1;

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

    render(renderPassEncoder, { graph, frustum, instances }) {
        renderPassEncoder.setViewport(...frustum.uniformViewport);
        super.render(renderPassEncoder, { graph, frustum, instances });
    }
}

export default SolidNode;