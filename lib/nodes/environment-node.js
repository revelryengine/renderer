import { CubeRenderNode             } from './cube-render-node.js';
import { RenderNode                 } from './render-node.js';
import { ResampleShader             } from '../shaders/resample-shader.js';
import { PrefilterShader, LUTShader } from '../shaders/prefilter-shader.js';
import { Environment                } from '../environment.js';

import { vec3                                  } from '../../deps/gl-matrix.js';
import { float16, pad3ChannelFormat, cubeCoord } from '../utils.js';

import { BRDF_DISTRIBUTIONS, TEXTURE_USAGE, VK_FORMAT_ENVIRONMENT } from '../constants.js';

const SPHERICAL_HARMONICS_SAMPLE_SIZE = 128;
const PREFILTER_SAMPLE_SIZE = 512; // 1024 is too high for some mobile devices
const ENVIRONMENT_SIZE = 512;
const ENVIRONMENT_MIPLEVEL_COUNT = Math.floor(Math.log2(ENVIRONMENT_SIZE)) + 1;

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

class PrefilterNode extends RenderNode {
    constructor(renderPath, { source, destination, distribution, mipLevelCount }) {
        super(renderPath);

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

        const shader    = new PrefilterShader(this.gal, { view, format: 'rgba16float', distribution, roughness, sampleCount: PREFILTER_SAMPLE_SIZE });
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
 * Uses output shader to downsample the cubemap texture
 */
 class DownsampleNode extends CubeRenderNode {
    attachments = {
        colors: [
            { name: 'color', format: 'rgba16float' },
        ]
    }

    size = { width: SPHERICAL_HARMONICS_SAMPLE_SIZE, height: SPHERICAL_HARMONICS_SAMPLE_SIZE }

    constructor(renderPath, cubemap) {
        super(renderPath);
        
        this.downsampleShader = new ResampleShader(this.gal, { label: 'DownsampleNode',
            view: cubemap.createView({ dimension: 'cube', mipLevelCount: 1 }), 
            format: 'rgba16float', viewDimension: 'cube', opaque: true, minFilter: 'linear',
        });
    }

    render(renderPassEncoder, face) {
        this.downsampleShader.run(renderPassEncoder, face);
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

    constructor(renderPath) {
        super(renderPath);
        this.lutNode = new LUTNode(renderPath); 
    }

    reconfigure() {
        super.reconfigure();
        this.lutNode.reconfigure();

        this.output.environment = new Environment(this.renderPath.gal);
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
                this.#deriveIrradianceCoefficients(commandEncoder, cubemap).then(irradianceCoefficients => {
                    graph.environment.irradianceCoefficients = irradianceCoefficients;
                });
            }

        }

        this.output.environment.mipLevelCount  = ENVIRONMENT_MIPLEVEL_COUNT;
        this.output.environment.upload();
    }

    /**
     * Downsample the cubemap and normalize the format type so that we can derive the irradiance coefficients more easily
     */
    async #downsampleCubemap(commandEncoder, cubemap) {     
        const { texture } = this.#getCubemapTexture(cubemap);  
        const downsample = new DownsampleNode(this.renderPath, texture);
        downsample.reconfigure();
        downsample.run(commandEncoder);

        const read  = await this.gal.readTexture({ 
            texture: downsample.output.color.texture, 
            size: { width: SPHERICAL_HARMONICS_SAMPLE_SIZE, height: SPHERICAL_HARMONICS_SAMPLE_SIZE, depthOrArrayLayers: 6 },
            format: 'rgba16float'
        });

        const pixels = Float32Array.from([...new Uint16Array(read)].map(v => float16(v))); 
        return pixels;
    }

    async #deriveIrradianceCoefficients(commandEncoder, cubemap) {
        //Downsample to SPHERICAL_HARMONICS_SAMPLE_SIZE (128x128 seems to be sufficient)
        //Downsampling also ensures that the format is rgba32float regardless of the input ktx format.
        const data  = await this.#downsampleCubemap(commandEncoder, cubemap);

        const size = SPHERICAL_HARMONICS_SAMPLE_SIZE;

        const coefficients = [...new Array(9)].map(() => new Float32Array(3));

        const texel = (x, y, f) => {
            const i = ((f * size * size) + ((size * y) + x)) * 4;
            return new Float32Array(data.buffer, data.byteOffset + (i * 4), 3);
        }

        let weightSum = 0;
        for(let f = 0; f < 6; f++) {
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const u = ((x + 0.5) / size) * 2.0 - 1.0;
                    const v = ((y + 0.5) / size) * 2.0 - 1.0;

                    const temp   = 1.0 + u * u + v * v;
                    const weight = 4.0 / (Math.sqrt(temp) * temp);
                    // const weight = texelSolidAngle(x, y, size, size);
    
                    const [dx, dy, dz] = cubeCoord(u, v, f);
                    const color = texel(x, y, f);

                    for(let c = 0; c < 3; c++) { //this is faster than vec3 methods
                        const value = color[c] * weight;

                        //band 0
                        coefficients[0][c] += value * 0.282095;

                        //band 1
                        coefficients[1][c] += value * 0.488603 * dy;
                        coefficients[2][c] += value * 0.488603 * dz;
                        coefficients[3][c] += value * 0.488603 * dx;

                        //band 2
                        coefficients[4][c] += value * 1.092548 * dx * dy;
                        coefficients[5][c] += value * 1.092548 * dy * dz;
                        coefficients[6][c] += value * 0.315392 * (3.0 * dz * dz - 1.0);
                        coefficients[7][c] += value * 1.092548 * dx * dz;
                        coefficients[8][c] += value * 0.546274 * (dx * dx - dy * dy);  
                    }
                    weightSum += weight;
                }
            }
        }

        for(let c = 0; c < 9; c++) {
            vec3.scale(coefficients[c], coefficients[c], 4 * Math.PI / weightSum);
        }

        return coefficients;
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
        }

        const size  = { width: ktx.pixelWidth, height: ktx.pixelHeight, depthOrArrayLayers: 6 };
        const usage = TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.RENDER_ATTACHMENT;

        /**
         * discard last 4 miplevels to avoid artifacts?
         * @see https://docs.imgtec.com/Graphics_Techniques/PBR_with_IBL_for_PVR/topics/Assets/pbr_ibl__the_prefiltered_map.html#pbr_ibl__the_prefiltered_map__section_dqn_bh2_p3b
         */
        const mipLevelCount = Math.floor(Math.log2(size.width)) + 1;
        const texture       = this.gal.createTextureWithData({ format, size, mipLevelCount, usage, cubemap: true, data });
        return { texture, format, mipLevelCount };
    }

    #prefilterCubemap(commandEncoder, cubemap) {
        const { texture: source, format, mipLevelCount } = this.#getCubemapTexture(cubemap);
        const { envGGX, envCharlie } = this.output;

        const mipmapGenerator = this.gal.createMipmapGenerator(source, { format, mipLevelCount, size: { depthOrArrayLayers: 6 }, viewDimension: 'cube' });
        mipmapGenerator(commandEncoder);

        const ggx = new PrefilterNode(this.renderPath, { source, destination: envGGX.texture, distribution: BRDF_DISTRIBUTIONS.ggx, mipLevelCount: 10 });
        ggx.run(commandEncoder);

        const charlie = new PrefilterNode(this.renderPath, { source, destination: envCharlie.texture, distribution: BRDF_DISTRIBUTIONS.charlie, mipLevelCount: 10 });
        charlie.run(commandEncoder);
    }
}

export default EnvironmentNode;