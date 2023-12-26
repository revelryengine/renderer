import { GLTFNode  } from '../../common/nodes/gltf-node.js';
import { SkyShader } from '../shaders/sky-shader.js';

/**
 * The Main Node is responsible for rendering the glTF scene.
 */
export class MainNode extends GLTFNode {
    opaque = true;
    transmissive = true;
    alpha = true;

    #lastSettings;
    reconfigure() {
        const settings = /** @type {import('../standard-settings.js').StandardSettings}*/(this.settings);
        const {
            flags: {
                environment:  environmentEnabled,
                punctual:     punctualEnabled,
                fog:          fogEnabled,
                ssao:         ssaoEnabled,
                shadows:      shadowsEnabled,
                transmission: transmissionEnabled,
                skybox:       skyboxEnabled,
                alphaBlendMode,
                msaa: msaaSamples,
                tonemap,
                debugPBR,
            },
        } = settings;

        const temporal = 'temporal' in this.settings && this.settings.temporal;

        const currentSettings = JSON.stringify({ debugPBR, tonemap, temporal, alphaBlendMode,  msaaSamples,
            environmentEnabled, punctualEnabled, fogEnabled, ssaoEnabled, shadowsEnabled, transmissionEnabled, skyboxEnabled,
        });

        if(this.#lastSettings !== currentSettings) {
            this.#lastSettings = currentSettings;
            this.clearShaderCache();
            this.destroy(); // need this to make sure that the dynamically enabled textures gets created/destroyed

            this.attachments.colors.accum.enabled  = alphaBlendMode === 'weighted';
            this.attachments.colors.reveal.enabled = alphaBlendMode === 'weighted';

            this.attachments.colors.point.enabled  = false;
            this.attachments.colors.id.enabled     = false;
            this.attachments.colors.motion.enabled = temporal;
        }

        this.sampleCount = msaaSamples;

        super.reconfigure();

        const { entries, bindGroupLocations } = this.getBindGroupEntries();
        this.bindGroupLocations = bindGroupLocations;

        this.bindGroupLayout = this.gal.device.createBindGroupLayout({
            label: this.constructor.name,
            entries: entries.layout,
        });

        this.bindGroup = this.gal.device.createBindGroup({
            label: this.constructor.name,
            layout: this.bindGroupLayout,
            entries: entries.group,
        });

        if(environmentEnabled && skyboxEnabled) {
            this.skyShader = new SkyShader(this.gal, { settings: this.renderPath.settings, renderNode: this, sampleCount: this.sampleCount }).compile();
        } else {
            this.skyShader = null;
        }
    }

    render(renderPassEncoder, { graph, frustum, instances }) {
        super.render(renderPassEncoder, { graph, frustum, instances });
    }

    renderOpaque(renderPassEncoder, ...args) {
        super.renderOpaque(renderPassEncoder, ...args);
        this.skyShader?.run(renderPassEncoder);
    }
}

export default MainNode;
