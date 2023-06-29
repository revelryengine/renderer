import { BRDF_DISTRIBUTIONS, TEXTURE_USAGE, VK_FORMAT_ENVIRONMENT } from '../../../constants.js';
import { Environment } from '../../../environment.js';

import { RenderNode, CubeRenderNode } from '../../common/nodes/render-node.js';
import { ResampleShader             } from '../../common/shaders/resample-shader.js';

import { PrefilterShader, LUTShader } from '../shaders/prefilter-shader.js';

import { float16, pad3ChannelFormat, deriveIrradianceCoefficients } from '../../../utils.js';

const ENVIRONMENT_SIZE = 512;
const ENVIRONMENT_MIPLEVEL_COUNT = Math.floor(Math.log2(ENVIRONMENT_SIZE)) + 1;
const SPHERICAL_HARMONICS_SAMPLE_SIZE = ENVIRONMENT_SIZE / 4;
const PREFILTER_SAMPLE_SIZE = 512; // 1024 is too high for some mobile devices

/**
 * This node only needs to run once to generate the environment LUT.
 */
class LUTNode extends RenderNode {
    attachments = {
        colors: { 
            color: { location: 0, format: 'rgba16float' },
        },
    };

    size = { width: PREFILTER_SAMPLE_SIZE, height: PREFILTER_SAMPLE_SIZE };
    
    render(renderPassEncoder) {
        this.shader.run(renderPassEncoder);
    }

    async runWhenReady() {
        this.shader = new LUTShader(this.gal, { format: this.attachments.colors.color.format, sampleCount: PREFILTER_SAMPLE_SIZE });
        await this.shader.initialized;

        const commandEncoder = this.gal.device.createCommandEncoder();
        
        this.run(commandEncoder);

        this.gal.device.queue.submit([commandEncoder.finish()]);
    }
}

/**
 * Uses output shader to resample the cubemap texture and generate mipmaps
 * This ensures that the working format is rgba16float regardless of the input ktx format.
 */
class ResampleNode extends CubeRenderNode {
    attachments = {
        colors: { 
            color: { location: 0, format: 'rgba16float', mipLevelCount: ENVIRONMENT_MIPLEVEL_COUNT },
        }
    }

    size = { width: ENVIRONMENT_SIZE, height: ENVIRONMENT_SIZE }

    constructor(renderPath, cubemap) {
        super(renderPath);
        
        this.resampleShader = new ResampleShader(this.gal, { 
            label:  'ResampleNode',
            view:   cubemap.createView({ dimension: 'cube', mipLevelCount: 1 }), 
            format: 'rgba16float', viewDimension: 'cube', opaque: true, minFilter: 'linear',
        });        
    }

    reconfigure() {
        super.reconfigure();
        this.mipmapGenerator = this.gal.createMipmapGenerator(this.output.color.texture, 'cube');
    }

    done = false;
    run(commandEncoder) {
        super.run(commandEncoder);
        this.mipmapGenerator(commandEncoder);
        this.done = true;
    }

    render(renderPassEncoder, face) {
        this.resampleShader.run(renderPassEncoder, face);
    }
}

class PrefilterEnvironmentNode extends RenderNode {
    constructor(renderPath, { source, textures }) {
        super(renderPath);

        this.source   = source;
        this.textures = textures;
        this.view     = source.createView({ dimension: 'cube' });

        this.#prepareShaders().then(() => this.ready = true);
    }

    levelRunCount = 0;

    get done() {
        return this.levelRunCount >= ENVIRONMENT_MIPLEVEL_COUNT;
    }

    begin(commandEncoder, { face, distribution }) {
        return commandEncoder.beginRenderPass({
            label: `${this.constructor.name} (face ${face})`,
            colorAttachments: [{
                view: this.textures[distribution].createView({ dimension: '2d', baseArrayLayer: face, baseMipLevel: this.levelRunCount, mipLevelCount: 1 }),
                clearValue: [0, 0, 0, 0],
                storeOp: 'store',
                loadOp: 'clear',
            }],
        });
    }

    render(renderPassEncoder, { face, distribution }) {    
        this.#prefilterShaders[distribution][this.levelRunCount].run(renderPassEncoder, face);
    }

    run(commandEncoder) {
        if(!this.ready || this.done) return;

        for(let face = 0; face < 6; face++){
            for(const distribution of ['ggx', 'charlie']) {
                const renderPassEncoder = this.begin(commandEncoder, { face, distribution });
                this.render(renderPassEncoder, { face, distribution });
                this.end(renderPassEncoder, { face, distribution });
            }
            
        }
        this.levelRunCount++;
    }

    #prefilterShaders = {
        ggx:     [],
        charlie: [],
    };
    async #prepareShaders() {
        for(let level = 0; level < ENVIRONMENT_MIPLEVEL_COUNT; level++) {
            await new Promise(resolve => requestAnimationFrame(resolve));

            const roughness = level / (ENVIRONMENT_MIPLEVEL_COUNT - 1);
            this.#prefilterShaders.ggx[level]     = new PrefilterShader(this.gal, { view: this.view, format: 'rgba16float', distribution: BRDF_DISTRIBUTIONS['ggx'],     roughness, sampleCount: PREFILTER_SAMPLE_SIZE });
            this.#prefilterShaders.charlie[level] = new PrefilterShader(this.gal, { view: this.view, format: 'rgba16float', distribution: BRDF_DISTRIBUTIONS['charlie'], roughness, sampleCount: PREFILTER_SAMPLE_SIZE });
        }

        return Promise.all([...this.#prefilterShaders.ggx, ...this.#prefilterShaders.charlie].map(shader => shader.initialized));
    }
}



/**
 * The Environment Node is responsible for capturing the radiance and irradiance maps of the scene if present
 */
export class EnvironmentNode extends CubeRenderNode {
    #prefiltered = new WeakSet();

    attachments = {
        colors: { 
            envGGX:     { location: 0, format: 'rgba16float', mipLevelCount: ENVIRONMENT_MIPLEVEL_COUNT },
            envCharlie: { location: 1, format: 'rgba16float', mipLevelCount: ENVIRONMENT_MIPLEVEL_COUNT },
        }
    }

    size = { width: ENVIRONMENT_SIZE, height: ENVIRONMENT_SIZE };

    constructor(renderPath) {
        super(renderPath);
        this.lutNode = new LUTNode(renderPath); 
        this.lutNode.reconfigure();
        this.lutNode.runWhenReady();
    }

    reconfigure() {
        super.reconfigure();

        this.output.environment = new Environment(this.gal, { mipLevelCount: ENVIRONMENT_MIPLEVEL_COUNT });
        this.output.envLUT      = this.lutNode.output.color;
    }

    destroy() {
        this.lutNode.destroy();
        super.destroy();
    }

    run(commandEncoder, { graph }) {
        if(graph.environment) {
            this.output.environment.irradianceCoefficients = graph.environment.irradianceCoefficients;

            if(graph.environment.boundingBoxMin) {
                this.output.environment.localized      = true;
                this.output.environment.boundingBoxMin = graph.environment.boundingBoxMin;
                this.output.environment.boundingBoxMax = graph.environment.boundingBoxMax;
            } else {
                this.output.environment.localized      = false;
                this.output.environment.boundingBoxMin = [0, 0, 0];
                this.output.environment.boundingBoxMax = [0, 0, 0];
            }
            
            this.#prefilterEnvironment(commandEncoder, graph.environment);
        }

        this.output.environment.upload();
    }

    async #deriveIrradianceCoefficients(cubemap) {
        //Read MipLevel 2 to downsample to SPHERICAL_HARMONICS_SAMPLE_SIZE (128x128 seems to be sufficient)

        const { resample } = this.#getCubemapTexture(cubemap);  

        const read  = await this.gal.readTexture({ 
            texture: resample.output.color.texture, 
            size: { width: SPHERICAL_HARMONICS_SAMPLE_SIZE, height: SPHERICAL_HARMONICS_SAMPLE_SIZE, depthOrArrayLayers: 6 },
            mipLevel: 2, //size 128
        });

        const data = Float32Array.from([...new Uint16Array(read)].map(v => float16(v))); 

        return deriveIrradianceCoefficients(data, SPHERICAL_HARMONICS_SAMPLE_SIZE);
    }


    #cubemapTextures = new WeakMap();
    #getCubemapTexture(cubemap) {
        return this.#cubemapTextures.get(cubemap) ?? this.#cubemapTextures.set(cubemap, this.#createCubemapTexture(cubemap)).get(cubemap);
    }

    #createCubemapTexture(cubemap){
        const ktx = cubemap.source.getImageDataKTX();

        const { format, pad, TypedArray } = VK_FORMAT_ENVIRONMENT[ktx.vkFormat];

        let data = ktx.levels[0].levelData;

        if(pad) {
            data = pad3ChannelFormat({ data, TypedArray });
        } else {
            data = new TypedArray(data.buffer, data.byteOffset, data.byteLength / TypedArray.BYTES_PER_ELEMENT);
        }

        const size  = { width: ktx.pixelWidth, height: ktx.pixelHeight, depthOrArrayLayers: 6 };
        const usage = TEXTURE_USAGE.TEXTURE_BINDING;

        /**
         * discard last 4 miplevels to avoid artifacts?
         * @see https://docs.imgtec.com/Graphics_Techniques/PBR_with_IBL_for_PVR/topics/Assets/pbr_ibl__the_prefiltered_map.html#pbr_ibl__the_prefiltered_map__section_dqn_bh2_p3b
         */
        const mipLevelCount = Math.floor(Math.log2(size.width)) + 1;
        const texture       = this.gal.createTextureWithData({ format, size, mipLevelCount, usage, cubemap: true, data });
        const resample      = new ResampleNode(this.renderPath, texture);

        resample.reconfigure();

        return { texture, resample, format, mipLevelCount };
    }
    
    #prefilterNodeCache = new WeakMap();
    #getPrefilterNode(cubemap) {
        return this.#prefilterNodeCache.get(cubemap) ?? this.#prefilterNodeCache.set(cubemap, this.#createPrefilterNode(cubemap)).get(cubemap);
    }

    #createPrefilterNode(cubemap) {
        const { resample } = this.#getCubemapTexture(cubemap);
        const source = resample.output.color.texture;
        const { envGGX, envCharlie } = this.output;
        return new PrefilterEnvironmentNode(this.renderPath, { source, textures: { ggx: envGGX.texture, charlie: envCharlie.texture } });

    }

    #prefilterEnvironment(commandEncoder, environment) {
        const { cubemap } = environment;
        if(cubemap) {
            if(this.#prefiltered.has(cubemap)) return;

            const { resample } = this.#getCubemapTexture(cubemap);
            if(!resample.done) {
                resample.run(commandEncoder);
            }

            const prefilter = this.#getPrefilterNode(cubemap);
            if(!prefilter.done) { 
                prefilter.run(commandEncoder);
            } else {
                if(!environment.irradianceCoefficients) {
                    environment.irradianceCoefficients = [];
                    this.#deriveIrradianceCoefficients(cubemap).then(irradianceCoefficients => {
                        environment.irradianceCoefficients = irradianceCoefficients;
                    });
                }
                this.#prefiltered.add(cubemap);
            }
        }
    }
}

export default EnvironmentNode;