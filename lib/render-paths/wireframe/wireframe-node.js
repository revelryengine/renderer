import { GLTFNode   } from '../common/nodes/gltf-node.js';
import { GLTFShader } from '../common/shaders/gltf-shader.js';

class GLTFWireframeShader extends GLTFShader {
    getFlags(...args) {
        const { settings } = this.input;

        const flags = super.getFlags(...args);
        return {
            ...flags,

            useShadows:      false,
            usePunctual:     false,
            useEnvironment:  false,
            useTransmission: false,
            useSSAO:         false,
            useFog:          false,
            isMask:          false,

            colorTargets: {
                color:  true,
                motion: settings.temporal,
            },

            doubleSided:    true,
            useBarycentric: true,
            deindex:        true,

            lighting: 'wireframe',
        }
    }
}

/**
 * The Wireframe node is responsible for rendering all glTF objects as wireframes.
 */
export class WireframeNode extends GLTFNode {
    Shader = GLTFWireframeShader;

    opaque = true;
    transmissive = true;
    alpha = true;

    #lastSettings;
    reconfigure() {
        const {
            flags: {
                msaa: msaaSamples,
            }
        } = this.settings;

        const temporal = 'temporal' in this.settings && this.settings.temporal;

        const currentSettings = JSON.stringify({ temporal, msaaSamples });

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

        this.sampleCount = msaaSamples;

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
        super.render(renderPassEncoder, { graph, frustum, instances });
    }
}

export default WireframeNode;
