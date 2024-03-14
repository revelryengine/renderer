import { UBO } from './ubo.js';
import { Material as GLTFMaterial } from '../deps/gltf.js';


/**
 * @typedef {import('../deps/gltf.js').TextureInfo | import('../deps/gltf.js').MaterialNormalTextureInfo | import('../deps/gltf.js').MaterialOcclusionTextureInfo} TextureInfo
 * @typedef {{
 *  [key: `${string}UVSet`]: number,
 *  [key: `${string}Scale`]: number,
 *  [key: `${string}UVTransform`]: Float32Array,
 * }} ExtensionWithTextureTransform
 */

/**
 * @todo - optimize this by dynamically creating the layout based on what extensions are included.
 * Will need to update material shader generator to use the material instance layout rather than static Material.layout.
 */
export class Material extends UBO.Layout({
    alphaCutoff:                         { type: 'f32'         },
    baseColorFactor:                     { type: 'vec4<f32>'   },
    baseColorTextureUVSet:               { type: 'i32'         },
    baseColorTextureUVTransform:         { type: 'mat3x3<f32>' },
    emissiveFactor:                      { type: 'vec3<f32>'   },
    emissiveTextureUVSet:                { type: 'i32'         },
    emissiveTextureUVTransform:          { type: 'mat3x3<f32>' },
    metallicFactor:                      { type: 'f32'         },
    metallicRoughnessTextureUVSet:       { type: 'i32'         },
    metallicRoughnessTextureUVTransform: { type: 'mat3x3<f32>' },
    normalTextureScale:                  { type: 'f32'         },
    normalTextureUVSet:                  { type: 'i32'         },
    normalTextureUVTransform:            { type: 'mat3x3<f32>' },
    occlusionStrength:                   { type: 'f32'         },
    occlusionTextureUVSet:               { type: 'i32'         },
    occlusionTextureUVTransform:         { type: 'mat3x3<f32>' },
    roughnessFactor:                     { type: 'f32'         },

    KHR_materials_pbrSpecularGlossiness: { type: 'KHR_materials_pbrSpecularGlossiness', layout: {
            diffuseFactor:                        { type: 'vec4<f32>'   },
            specularFactor:                       { type: 'vec3<f32>'   },
            glossinessFactor:                     { type: 'f32'         },
            diffuseTextureUVSet:                  { type: 'i32'         },
            diffuseTextureUVTransform:            { type: 'mat3x3<f32>' },
            specularGlossinessTextureUVSet:       { type: 'i32'         },
            specularGlossinessTextureUVTransform: { type: 'mat3x3<f32>' },
        },
    },

    KHR_materials_clearcoat: { type: 'KHR_materials_clearcoat', layout: {
            clearcoatFactor:                      { type: 'f32'         },
            clearcoatNormalTextureScale:          { type: 'f32'         },
            clearcoatNormalTextureUVSet:          { type: 'i32'         },
            clearcoatNormalTextureUVTransform:    { type: 'mat3x3<f32>' },
            clearcoatRoughnessFactor:             { type: 'f32'         },
            clearcoatRoughnessTextureUVSet:       { type: 'i32'         },
            clearcoatRoughnessTextureUVTransform: { type: 'mat3x3<f32>' },
            clearcoatTextureUVSet:                { type: 'i32'         },
            clearcoatTextureUVTransform:          { type: 'mat3x3<f32>' },
        },
    },

    KHR_materials_ior: { type: 'KHR_materials_ior', layout: {
            ior: { type: 'f32' },
        },
    },

    KHR_materials_iridescence: { type: 'KHR_materials_iridescence', layout: {
            iridescenceFactor:           { type: 'f32' },
            iridescenceIor:              { type: 'f32' },
            iridescenceThicknessMinimum: { type: 'f32' },
            iridescenceThicknessMaximum: { type: 'f32' },

            iridescenceTextureUVSet:                { type: 'i32'         },
            iridescenceTextureUVTransform:          { type: 'mat3x3<f32>' },
            iridescenceThicknessTextureUVSet:       { type: 'i32'         },
            iridescenceThicknessTextureUVTransform: { type: 'mat3x3<f32>' },
        },
    },

    KHR_materials_emissive_strength: { type: 'KHR_materials_emissive_strength', layout: {
            emissiveStrength: { type: 'f32' },
        },
    },

    KHR_materials_specular: { type: 'KHR_materials_specular', layout: {
            specularFactor:                  { type: 'f32'         },
            specularColorFactor:             { type: 'vec3<f32>'   },
            specularColorTextureUVSet:       { type: 'i32'         },
            specularColorTextureUVTransform: { type: 'mat3x3<f32>' },
            specularTextureUVSet:            { type: 'i32'         },
            specularTextureUVTransform:      { type: 'mat3x3<f32>' },
        },
    },

    KHR_materials_sheen: { type: 'KHR_materials_sheen', layout: {
            sheenColorFactor:                 { type: 'vec3<f32>'   },
            sheenColorTextureUVSet:           { type: 'i32'         },
            sheenColorTextureUVTransform:     { type: 'mat3x3<f32>' },
            sheenRoughnessFactor:             { type: 'f32'         },
            sheenRoughnessTextureUVSet:       { type: 'i32'         },
            sheenRoughnessTextureUVTransform: { type: 'mat3x3<f32>' },
        },
    },

    KHR_materials_transmission: { type: 'KHR_materials_transmission', layout: {
            transmissionFactor:             { type: 'f32'         },
            transmissionTextureUVSet:       { type: 'i32'         },
            transmissionTextureUVTransform: { type: 'mat3x3<f32>' },
        },
    },

    KHR_materials_volume: { type: 'KHR_materials_volume', layout: {
            attenuationColor:            { type: 'vec3<f32>'   },
            attenuationDistance:         { type: 'f32'         },
            thicknessFactor:             { type: 'f32'         },
            thicknessTextureUVSet:       { type: 'i32'         },
            thicknessTextureUVTransform: { type: 'mat3x3<f32>' },
        },
    },
}){
    /**
     * @param {import('./revgal.js').RevGAL} gal
     * @param {import('../deps/gltf.js').Material} material
     */
    constructor(gal, material) {
        super(gal);

        this.material = material;

        const { doubleSided, alphaMode = 'OPAQUE' } = material;

        this.doubleSided = doubleSided;
        this.alphaMode   = alphaMode;

        this.upload();
    }

    upload() {
        const { material } = this;

        const {
            pbrMetallicRoughness = /** @type {import('../deps/gltf.js').MaterialPBRMetallicRoughness} */({}),
            normalTexture, occlusionTexture, emissiveTexture, emissiveFactor, alphaCutoff
        } = material;

        const {
            baseColorFactor = [1, 1, 1, 1], metallicFactor = 1, roughnessFactor = 1, baseColorTexture, metallicRoughnessTexture
        } = pbrMetallicRoughness;

        this.baseColorFactor.set(baseColorFactor);
        this.emissiveFactor.set(emissiveFactor);

        this.metallicFactor     = metallicFactor;
        this.roughnessFactor    = roughnessFactor
        this.alphaCutoff        = alphaCutoff;
        this.normalTextureScale = normalTexture?.scale ?? 1,
        this.occlusionStrength  = occlusionTexture?.strength ?? 1;

        this.textures   = /** @type {{ [key: string]: TextureInfo}} */({ normalTexture, occlusionTexture, emissiveTexture, baseColorTexture, metallicRoughnessTexture });
        this.extensions = material.extensions ?? {};

        this.receivesShadows = material.extras?.receivesShadows ?? true;
        this.castsShadows    = material.extras?.castsShadows ?? true;

        for (const n in this.textures) {
            const name = /** @type {'normalTexture' | 'occlusionTexture' | 'emissiveTexture' | 'baseColorTexture' | 'metallicRoughnessTexture'} */(n);
            const texture = this.textures[name];
            if (texture) {
                this[`${name}UVSet`] = texture.texCoord;
                const transform = texture.extensions?.KHR_texture_transform;
                if(transform){
                    if(transform.texCoord !== undefined) this[`${name}UVSet`] = transform.texCoord;
                    this[`${name}UVTransform`].set(UBO.std140Mat3(transform.getTransform()));
                }
            }
        }

        for (const n in material.extensions) {
            const extName = /** @type {keyof Material & keyof Revelry.GLTF.Extensions.Material} */(n)
            if(extName in this) {
                const ext = material.extensions[extName];
                this[extName].set(/** @type {any} */(ext));// Assumes GLTF is valid and properties will match

                for(const texName in ext) {
                    if(texName.endsWith('Texture')){
                        const texture = /** @type {TextureInfo} */(ext[/** @type {keyof ext} */(texName)]);

                        if(texture) {
                            const extProp = /** @type {ExtensionWithTextureTransform} */(this[extName]);

                            extProp[`${texName}UVSet`] = texture.texCoord;
                            if('scale' in texture) extProp[`${texName}Scale`] = texture.scale;

                            const transform = texture.extensions?.KHR_texture_transform;
                            if(transform){
                                if(transform.texCoord !== undefined) extProp[`${texName}UVSet`] = transform.texCoord;
                                extProp[`${texName}UVTransform`].set(UBO.std140Mat3(transform.getTransform()));
                            }
                            this.textures[`${extName}.${texName}`] = texture;
                        }
                    }
                }
            }
        }

        super.upload();
    }

    static DEFAULT_MATERIAL = new GLTFMaterial({});
}
