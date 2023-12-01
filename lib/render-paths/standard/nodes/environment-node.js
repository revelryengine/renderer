import { BRDF_DISTRIBUTIONS, SHADER_STAGE, TEXTURE_USAGE, VK_FORMAT_ENVIRONMENT } from '../../../constants.js';
import { Environment } from '../../../environment.js';

import { RenderNode, CubeRenderNode } from '../../render-node.js';
import { ResampleShader             } from '../../common/shaders/resample-shader.js';

import { PrefilterShader, LUTShader, Prefilter } from '../shaders/prefilter-shader.js';

import { float16, pad3ChannelFormat, WeakCache } from '../../../../deps/utils.js';
import { vec3 } from '../../../../deps/gl-matrix.js';


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

    reconfigure() {
        super.reconfigure();

        this.shader   = new LUTShader(this.gal, { format: this.attachments.colors.color.format, sampleCount: PREFILTER_SAMPLE_SIZE }).compileAsync();
        this.complete = this.shader.compiled.then(() => {
            const commandEncoder = this.gal.device.createCommandEncoder();
            this.run(commandEncoder);
            this.gal.device.queue.submit([commandEncoder.finish()]);
        });
        return this;
    }

    render(renderPassEncoder) {
        this.shader.run(renderPassEncoder);
    }
}

/**
 * Uses output shader to resample the cubemap texture and generate mipmaps
 * This ensures that the working format is rgba16float regardless of the input ktx format.
 */
class EnvironmentResampleNode extends CubeRenderNode {
    attachments = {
        colors: {
            color: { location: 0, format: 'rgba16float', mipLevelCount: ENVIRONMENT_MIPLEVEL_COUNT },
        }
    }

    size = { width: ENVIRONMENT_SIZE, height: ENVIRONMENT_SIZE }

    constructor(renderPath, environment) {
        super(renderPath);
        this.environment = environment;
    }

    reconfigure() {
        super.reconfigure();

        const ktx = this.environment.cubemap.source.getImageDataKTX();

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
        const view          = texture.createView({ dimension: 'cube', mipLevelCount: 1 });

        this.shader = new ResampleShader(this.gal, { label: 'ResampleNode', view, format: 'rgba16float', viewDimension: 'cube', opaque: true, minFilter: 'linear' }).compileAsync();

        this.mipmapGenerator = this.gal.createMipmapGenerator(this.output.color.texture, 'cube');

        this.complete = this.shader.compiled.then(() => {
            const commandEncoder = this.gal.device.createCommandEncoder();
            this.run(commandEncoder);
            this.gal.device.queue.submit([commandEncoder.finish()]);
        });

        return this;
    }

    render(renderPassEncoder, face) {
        this.shader.run(renderPassEncoder, face);
    }

    run(commandEncoder) {
        super.run(commandEncoder);
        this.mipmapGenerator(commandEncoder);
    }
}

class EnvironmentPrefilterNode extends RenderNode {
    constructor(renderPath, environment, resample, textures) {
        super(renderPath);

        this.environment = environment;
        this.resample    = resample;
        this.textures    = textures;
    }

    reconfigure() {
        this.ggxShader     = new PrefilterShader(this.gal, { format: 'rgba16float', distribution: BRDF_DISTRIBUTIONS['ggx'], sampleCount: PREFILTER_SAMPLE_SIZE }).compileAsync();
        this.charlieShader = new PrefilterShader(this.gal, { format: 'rgba16float', distribution: BRDF_DISTRIBUTIONS['ggx'], sampleCount: PREFILTER_SAMPLE_SIZE }).compileAsync();

        const sampler = this.gal.device.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear' });
        const view    = this.resample.output.color.texture.createView({ dimension: 'cube' });

        this.bindGroup = this.gal.device.createBindGroup({
            layout: this.gal.device.createBindGroupLayout({
                entries: [
                    { binding: 0, visibility: SHADER_STAGE.FRAGMENT, sampler: {} },
                    { binding: 1, visibility: SHADER_STAGE.FRAGMENT, texture: { viewDimension: 'cube' } },
                ],
            }),
            entries: [
                { binding: 0, resource: sampler },
                { binding: 1, resource: view },
            ]
        });

        this.roughnessBindGroups = [];
        for(let level = 0; level < ENVIRONMENT_MIPLEVEL_COUNT; level++) {
            const prefilter = new Prefilter(this.gal, { roughness: level / (ENVIRONMENT_MIPLEVEL_COUNT - 1) });
            prefilter.upload();

            this.roughnessBindGroups.push(this.gal.device.createBindGroup({
                layout: this.gal.device.createBindGroupLayout({
                    entries: [
                        { binding: 0, visibility: SHADER_STAGE.FRAGMENT, buffer:  {} },
                    ],
                }),
                entries: [
                    { binding: 0, resource: { buffer: prefilter.buffer } },
                ]
            }));
        }

        this.complete = Promise.all([this.ggxShader.compiled, this.charlieShader.compiled]).then(() => {
            const commandEncoder = this.gal.device.createCommandEncoder();
            this.run(commandEncoder);
            this.gal.device.queue.submit([commandEncoder.finish()]);
        });

        return this;
    }

    begin(commandEncoder, { face, distribution, level }) {
        return commandEncoder.beginRenderPass({
            label: `${this.constructor.name} (face ${face})`,
            colorAttachments: [{
                view: this.textures[distribution].createView({ dimension: '2d', baseArrayLayer: face, baseMipLevel: level, mipLevelCount: 1 }),
                clearValue: [0, 0, 0, 0],
                storeOp: 'store',
                loadOp: 'clear',
            }],
        });
    }

    render(renderPassEncoder, { face, distribution, level }) {
        renderPassEncoder.setBindGroup(0, this.bindGroup);
        renderPassEncoder.setBindGroup(1, this.roughnessBindGroups[level]);
        this[`${distribution}Shader`].run(renderPassEncoder, face);
    }

    run(commandEncoder) {
        for(const distribution of ['ggx', 'charlie']) {
            for(let face = 0; face < 6; face++){
                for(let level = 0; level < ENVIRONMENT_MIPLEVEL_COUNT; level++) {
                    const renderPassEncoder = this.begin(commandEncoder, { face, distribution, level });
                    this.render(renderPassEncoder, { face, distribution, level });
                    this.end(renderPassEncoder);
                }
            }
        }
    }
}

/**
 * The Environment Node is responsible for capturing the radiance and irradiance maps of the scene if present
 */
export class EnvironmentNode extends CubeRenderNode {
    attachments = {
        colors: {
            envGGX:     { location: 0, format: 'rgba16float', mipLevelCount: ENVIRONMENT_MIPLEVEL_COUNT },
            envCharlie: { location: 1, format: 'rgba16float', mipLevelCount: ENVIRONMENT_MIPLEVEL_COUNT },
        }
    }

    size = { width: ENVIRONMENT_SIZE, height: ENVIRONMENT_SIZE };

    reconfigure() {
        super.reconfigure();

        this.lutNode ??= new LUTNode(this.renderPath).reconfigure();

        this.output.environment = new Environment(this.gal, { mipLevelCount: ENVIRONMENT_MIPLEVEL_COUNT });
        this.output.envLUT      = this.lutNode.output.color;
    }

    destroy() {
        this.lutNode?.destroy();
        super.destroy();
    }

    run(commandEncoder, { graph }) {
        if(graph.environment) {
            this.output.environment.set({ irradianceCoefficients: graph.environment.irradianceCoefficients });

            if(graph.environment.boundingBoxMin) {
                this.output.environment.set({
                    localized: true,
                    boundingBoxMin: graph.environment.boundingBoxMin,
                    boundingBoxMax: graph.environment.boundingBoxMax,
                });
            } else {
                this.output.environment.set({
                    localized: false,
                    boundingBoxMin: [0, 0, 0],
                    boundingBoxMax: [0, 0, 0],
                });
            }

            this.#prefilterEnvironment(graph.environment);
        }

        this.output.environment.upload();
    }

    async #deriveIrradianceCoefficients(resample) {
        //Read MipLevel 2 to downsample to SPHERICAL_HARMONICS_SAMPLE_SIZE (128x128 seems to be sufficient)

        const read  = await this.gal.readTexture({
            texture: resample.output.color.texture,
            size: { width: SPHERICAL_HARMONICS_SAMPLE_SIZE, height: SPHERICAL_HARMONICS_SAMPLE_SIZE, depthOrArrayLayers: 6 },
            mipLevel: 2, //size 128
        });

        const data = Float32Array.from([...new Uint16Array(read)].map(v => float16(v)));
        return deriveIrradianceCoefficients(data, SPHERICAL_HARMONICS_SAMPLE_SIZE);
    }

    #prefilterCache = new WeakCache();
    async #prefilterEnvironment(environment) {
        const cache = this.#prefilterCache.ensure(environment, () => ({}));

        if(environment.cubemap) {
            cache.resample ??= new EnvironmentResampleNode(this.renderPath, environment).reconfigure();
            await cache.resample.complete;

            cache.prefilter ??= new EnvironmentPrefilterNode(this.renderPath, environment, cache.resample, { ggx: this.output.envGGX.texture, charlie: this.output.envCharlie.texture }).reconfigure();
            await cache.prefilter.complete;

            if(!environment.irradianceCoefficients) {
                cache.irradianceCoefficients ??= this.#deriveIrradianceCoefficients(cache.resample).then(irradianceCoefficients => {
                    environment.irradianceCoefficients = irradianceCoefficients
                });
                await cache.irradianceCoefficients;
            }
        }
    }

    async precompile(graph) {
        if(graph.environment) {
            await Promise.all([this.lutNode.complete, this.#prefilterEnvironment(graph.environment)]);
        }
    }
}

/**
 * @param {number} x
 * @param {number} y
 */
function areaElement (x, y) {
    return Math.atan2(x * y, Math.sqrt(x * x + y * y + 1.0))
}

/**
 * @param {number} aU
 * @param {number} aV
 * @param {number} width
 * @param {number} height
 */
function texelSolidAngle (aU, aV, width, height) {
    // transform from [0..res - 1] to [- (1 - 1 / res) .. (1 - 1 / res)]
    // ( 0.5 is for texel center addressing)
    const U = (2.0 * (aU + 0.5) / width) - 1.0
    const V = (2.0 * (aV + 0.5) / height) - 1.0

    // shift from a demi texel, mean 1.0 / size  with U and V in [-1..1]
    const invResolutionW = 1.0 / width
    const invResolutionH = 1.0 / height

    // U and V are the -1..1 texture coordinate on the current face.
    // get projected area for this texel
    const x0 = U - invResolutionW
    const y0 = V - invResolutionH
    const x1 = U + invResolutionW
    const y1 = V + invResolutionH
    const angle = areaElement(x0, y0) - areaElement(x0, y1) - areaElement(x1, y0) + areaElement(x1, y1)

    return angle
}


/**
 * Converts UV coordinates to cartesian coordinates for a cube face
 * Assumes Y down texture coordinates
 * @param {number} u - u coordinate in -1:+1 range
 * @param {number} v - v coordinate in -1:+1 range
 * @param {number} f - Face index
 */
function cubeCoord(u, v, f) {
    //+X, -X, +Y, -Y, +Z, -Z
    let res;
    switch(f) {
        case 0:
            res = [ 1,-v,-u];
            break;
        case 1:
            res = [-1,-v, u];
            break;
        case 2:
            res = [ u, 1, v];
            break;
        case 3:
            res = [ u,-1,-v];
            break;
        case 4:
            res = [ u,-v, 1];
            break;
        case 5:
            res = [-u,-v,-1];
            break;
        default:
            throw new Error('Invalid face number');
    }
    return vec3.normalize(res, res);
}


/**
 * @param {Float32Array} data
 * @param {number} size
 */
export function deriveIrradianceCoefficients(data, size) {
    const coefficients = [...new Array(9)].map(() => new Float32Array(3));

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} f
     */
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

export default EnvironmentNode;
