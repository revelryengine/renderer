import { CubeRenderNode             } from './cube-render-node.js';
import { RenderNode                 } from './render-node.js';
import { ResampleShader             } from '../shaders/resample-shader.js';
import { PrefilterShader, LUTShader } from '../shaders/prefilter-shader.js';
import { Environment                } from '../environment.js';

import { float16, pad3ChannelFormat, deriveIrradianceCoefficients } from '../utils.js';
import { BRDF_DISTRIBUTIONS, TEXTURE_USAGE, VK_FORMAT_ENVIRONMENT } from '../constants.js';

const ENVIRONMENT_SIZE = 512;
const ENVIRONMENT_MIPLEVEL_COUNT = Math.floor(Math.log2(ENVIRONMENT_SIZE)) + 1;
const SPHERICAL_HARMONICS_SAMPLE_SIZE = ENVIRONMENT_SIZE / 4;
const PREFILTER_SAMPLE_SIZE = 512; // 1024 is too high for some mobile devices

class LUTNode extends RenderNode {
    #generated;
    attachments = {
        colors: [
            { name: 'color', format: 'rgba16float' },
        ]
    };

    size = { width: PREFILTER_SAMPLE_SIZE, height: PREFILTER_SAMPLE_SIZE };
    run(commandEncoder) {
        if(!this.#generated) {
            super.run(commandEncoder);
            this.#generated = true;
        }
    }

    initAttachments(){
        if(!this.#generated){
            super.initAttachments();
        } 
    }

    render(renderPassEncoder) {
        const shader = new LUTShader(this.gal, { format: this.attachments.colors[0].format, sampleCount: PREFILTER_SAMPLE_SIZE });
        shader.run(renderPassEncoder);
    }
}

/**
 * Uses output shader to resample the cubemap texture and generate mipmaps
 * This ensures that the working format is rgba16float regardless of the input ktx format.
 */
class ResampleNode extends CubeRenderNode {
    attachments = {
        colors: [
            { name: 'color', format: 'rgba16float', mipLevelCount: ENVIRONMENT_MIPLEVEL_COUNT },
        ]
    }

    size = { width: ENVIRONMENT_SIZE, height: ENVIRONMENT_SIZE }

    constructor(renderer, cubemap) {
        super(renderer);
        
        this.resampleShader = new ResampleShader(this.gal, { 
            label:  'ResampleNode',
            view:   cubemap.createView({ dimension: 'cube', mipLevelCount: 1 }), 
            format: 'rgba16float', viewDimension: 'cube', opaque: true, minFilter: 'linear',
        });        
    }

    reconfigure() {
        super.reconfigure();
        this.mipmapGenerator = this.gal.createMipmapGenerator(this.output.color.texture, { format: 'rgba16float', mipLevelCount: ENVIRONMENT_MIPLEVEL_COUNT, size: { depthOrArrayLayers: 6 }, viewDimension: 'cube' });
    }

    run(commandEncoder) {
        super.run(commandEncoder);
        this.mipmapGenerator(commandEncoder);
    }

    render(renderPassEncoder, face) {
        this.resampleShader.run(renderPassEncoder, face);
    }
}

class PrefilterNode extends RenderNode {
    constructor(renderer, { source, destination, distribution, mipLevelCount }) {
        super(renderer);

        this.source        = source;
        this.destination   = destination;
        this.distribution  = distribution;
        this.mipLevelCount = mipLevelCount;
    }

    begin(commandEncoder, { face, level }) {
        return commandEncoder.beginRenderPass({
            label: `${this.constructor.name} (face ${face})`,
            colorAttachments: [{
                view: this.destination.createView({ dimension: '2d', baseArrayLayer: face, baseMipLevel: level, mipLevelCount: 1 }),
                clearValue: [0, 0, 0, 0],
                storeOp: 'store',
                loadOp: 'clear',
            }],
        });
    }

    render(renderPassEncoder, { face, level }) {    
        const roughness    = level / (this.mipLevelCount - 1);
        const view         = this.source.createView({ dimension: 'cube' });
        const distribution = this.distribution;

        const shader = new PrefilterShader(this.gal, { view, format: 'rgba16float', distribution, roughness, sampleCount: PREFILTER_SAMPLE_SIZE });
        shader.run(renderPassEncoder, face);
    }

    run(commandEncoder) {
        for(let face = 0; face < 6; face++){
            for(let level = 0; level < this.mipLevelCount; level++) {
                const renderPassEncoder = this.begin(commandEncoder, { face, level });
                this.render(renderPassEncoder, { face, level });
                this.end(renderPassEncoder, { face, level });
            }
        }
    }
}



/**
 * The Environment Node is responsible for capturing the radiance and irradiance maps of the scene if present
 */
export class EnvironmentNode extends CubeRenderNode {
    #prefiltered = new WeakSet();

    attachments = {
        colors: [
            { name: 'envGGX',     format: 'rgba16float', mipLevelCount: ENVIRONMENT_MIPLEVEL_COUNT },
            { name: 'envCharlie', format: 'rgba16float', mipLevelCount: ENVIRONMENT_MIPLEVEL_COUNT },
        ]
    }

    size = { width: ENVIRONMENT_SIZE, height: ENVIRONMENT_SIZE };

    constructor(renderer) {
        super(renderer);
        this.lutNode = new LUTNode(renderer); 
    }

    reconfigure() {
        super.reconfigure();
        this.lutNode.reconfigure();

        this.output.environment = new Environment(this.renderer.gal);
        this.output.envLUT      = this.lutNode.output.color;
    }

    destroy() {
        this.lutNode.destroy();
        super.destroy();
    }

    run(commandEncoder, { graph }) {
        this.lutNode.run(commandEncoder);
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
            
            const { cubemap } = graph.environment;
            if(cubemap && !this.#prefiltered.has(cubemap)){
                this.#prefilterCubemap(commandEncoder, cubemap);
                this.#prefiltered.add(cubemap);
            } else if(!cubemap) {
                //clear textures?
            }

            if(!graph.environment.irradianceCoefficients) {
                graph.environment.irradianceCoefficients = [];
                this.#deriveIrradianceCoefficients(cubemap).then(irradianceCoefficients => {
                    graph.environment.irradianceCoefficients = irradianceCoefficients;
                });
            }

        }

        this.output.environment.mipLevelCount  = ENVIRONMENT_MIPLEVEL_COUNT;
        this.output.environment.upload();
    }

    async #deriveIrradianceCoefficients(cubemap) {
        //Read MipLevel 2 to downsample to SPHERICAL_HARMONICS_SAMPLE_SIZE (128x128 seems to be sufficient)

        const { resample } = this.#getCubemapTexture(cubemap);  

        const read  = await this.gal.readTexture({ 
            texture: resample.output.color.texture, 
            size: { width: SPHERICAL_HARMONICS_SAMPLE_SIZE, height: SPHERICAL_HARMONICS_SAMPLE_SIZE, depthOrArrayLayers: 6 },
            format: 'rgba16float',
            mipLevel: 2, //size 128
        });

        const data = Float32Array.from([...new Uint16Array(read)].map(v => float16(v))); 

        return deriveIrradianceCoefficients(data, SPHERICAL_HARMONICS_SAMPLE_SIZE);
    }


    #cubemapTextures = new WeakMap();
    #getCubemapTexture(cubemap) {
        return this.#cubemapTextures.get(cubemap) || this.#cubemapTextures.set(cubemap, this.#createCubemapTexture(cubemap)).get(cubemap);
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
        const resample      = new ResampleNode(this.renderer, texture);

        resample.reconfigure();

        return { texture, resample, format, mipLevelCount };
    }

    #prefilterCubemap(commandEncoder, cubemap) {
        const { resample } = this.#getCubemapTexture(cubemap);

        resample.run(commandEncoder);

        const { envGGX, envCharlie } = this.output;
        const source = resample.output.color.texture;

        const ggx = new PrefilterNode(this.renderer, { source, destination: envGGX.texture, distribution: BRDF_DISTRIBUTIONS.ggx, mipLevelCount: 10 });
        ggx.run(commandEncoder);

        const charlie = new PrefilterNode(this.renderer, { source, destination: envCharlie.texture, distribution: BRDF_DISTRIBUTIONS.charlie, mipLevelCount: 10 });
        charlie.run(commandEncoder);
    }
}

export default EnvironmentNode;