import { UBO          } from './ubo.js';

/**
 * @todo - optimiize this by dynamically creating the layout based on what extensions are included. 
 * Will need to update material shader generator to use the material instance layout rather than static Material.layout.
 */
export class Material extends UBO {
    static layout = new UBO.Layout([
        { name: 'alphaCutoff',                         type: 'f32'         },
        { name: 'baseColorFactor',                     type: 'vec4<f32>'   },
        { name: 'baseColorTextureUVSet',               type: 'i32'         },
        { name: 'baseColorTextureUVTransform',         type: 'mat3x3<f32>' },
        { name: 'emissiveFactor',                      type: 'vec3<f32>'   },
        { name: 'emissiveTextureUVSet',                type: 'i32'         },
        { name: 'emissiveTextureUVTransform',          type: 'mat3x3<f32>' },
        { name: 'metallicFactor',                      type: 'f32'         },
        { name: 'metallicRoughnessTextureUVSet',       type: 'i32'         },
        { name: 'metallicRoughnessTextureUVTransform', type: 'mat3x3<f32>' },
        { name: 'normalScale',                         type: 'f32'         },
        { name: 'normalTextureUVSet',                  type: 'i32'         },
        { name: 'normalTextureUVTransform',            type: 'mat3x3<f32>' },
        { name: 'occlusionStrength',                   type: 'f32'         },
        { name: 'occlusionTextureUVSet',               type: 'i32'         },
        { name: 'occlusionTextureUVTransform',         type: 'mat3x3<f32>' },
        { name: 'roughnessFactor',                     type: 'f32'         },

        { name: 'KHR_materials_pbrSpecularGlossiness', type: 'KHR_materials_pbrSpecularGlossiness', layout: [
                { name: 'diffuseFactor',                        type: 'vec4<f32>'   },
                { name: 'specularFactor',                       type: 'vec3<f32>'   },
                { name: 'glossinessFactor',                     type: 'f32'         },
                { name: 'diffuseTextureUVSet',                  type: 'i32'         },
                { name: 'diffuseTextureUVTransform',            type: 'mat3x3<f32>' },
                { name: 'specularGlossinessTextureUVSet',       type: 'i32'         },
                { name: 'specularGlossinessTextureUVTransform', type: 'mat3x3<f32>' },
            ],
        },

        { name: 'KHR_materials_clearcoat', type: 'KHR_materials_clearcoat', layout: [
                { name: 'clearcoatFactor',                      type: 'f32'         },
                { name: 'clearcoatNormalScale',                 type: 'f32'         },
                { name: 'clearcoatNormalTextureUVSet',          type: 'i32'         },
                { name: 'clearcoatNormalTextureUVTransform',    type: 'mat3x3<f32>' },
                { name: 'clearcoatRoughnessFactor',             type: 'f32'         },
                { name: 'clearcoatRoughnessTextureUVSet',       type: 'i32'         },
                { name: 'clearcoatRoughnessTextureUVTransform', type: 'mat3x3<f32>' },
                { name: 'clearcoatTextureUVSet',                type: 'i32'         },
                { name: 'clearcoatTextureUVTransform',          type: 'mat3x3<f32>' },
            ],
        },

        { name: 'KHR_materials_specular', type: 'KHR_materials_specular', layout: [
                { name: 'specularFactor',                  type: 'f32'         },
                { name: 'specularColorFactor',             type: 'vec3<f32>'   },
                { name: 'specularColorTextureUVSet',       type: 'i32'         },
                { name: 'specularColorTextureUVTransform', type: 'mat3x3<f32>' },
                { name: 'specularTextureUVSet',            type: 'i32'         },
                { name: 'specularTextureUVTransform',      type: 'mat3x3<f32>' },
            ],
        },

        { name: 'KHR_materials_sheen', type: 'KHR_materials_sheen', layout: [
                { name: 'sheenColorFactor',                 type: 'vec3<f32>'   },
                { name: 'sheenColorTextureUVSet',           type: 'i32'         },
                { name: 'sheenColorTextureUVTransform',     type: 'mat3x3<f32>' },
                { name: 'sheenRoughnessFactor',             type: 'f32'         },
                { name: 'sheenRoughnessTextureUVSet',       type: 'i32'         },
                { name: 'sheenRoughnessTextureUVTransform', type: 'mat3x3<f32>' },
            ],
        },

        { name: 'KHR_materials_ior', type: 'KHR_materials_ior', layout: [
                { name: 'ior', type: 'f32' },
            ],
        },

        { name: 'KHR_materials_transmission', type: 'KHR_materials_transmission', layout: [
                { name: 'transmissionFactor',             type: 'f32'         },
                { name: 'transmissionTextureUVSet',       type: 'i32'         },
                { name: 'transmissionTextureUVTransform', type: 'mat3x3<f32>' },
            ],
        },

        { name: 'KHR_materials_volume', type: 'KHR_materials_volume', layout: [
                { name: 'attenuationColor',            type: 'vec3<f32>'   },
                { name: 'attenuationDistance',         type: 'f32'         },
                { name: 'thicknessFactor',             type: 'f32'         },
                { name: 'thicknessTextureUVSet',       type: 'i32'         },
                { name: 'thicknessTextureUVTransform', type: 'mat3x3<f32>' },
            ],
        },
    ]);
    
    constructor(gal, material = {}) {
        super(gal);

        this.material = material;

        const {
            pbrMetallicRoughness = {},
            normalTexture, occlusionTexture, emissiveTexture, emissiveFactor, doubleSided, alphaMode, alphaCutoff
        } = material;

        const {
            baseColorFactor = [1, 1, 1, 1], metallicFactor = 1, roughnessFactor = 1, baseColorTexture, metallicRoughnessTexture
        } = pbrMetallicRoughness;

        this.baseColorFactor   = baseColorFactor;
        this.metallicFactor    = metallicFactor;
        this.roughnessFactor   = roughnessFactor
        this.emissiveFactor    = emissiveFactor
        this.alphaCutoff       = alphaCutoff
        this.normalScale       = normalTexture?.scale,
        this.occlusionStrength = occlusionTexture?.strength;

        this.textures   = { normalTexture, occlusionTexture, emissiveTexture, baseColorTexture, metallicRoughnessTexture };
        this.extensions = material.extensions || {};
        
        for (const name in this.textures) {
            const texture = this.textures[name];
            if (texture) {
                this[`${name}UVSet`] = texture.texCoord;

                const { KHR_texture_transform: transform } = texture.extensions;
                if(transform){
                    if(transform.texCoord !== undefined) this[`${name}UVSet`] = transform.texCoord;
                    this[`${name}UVTransform`] = UBO.std140Mat3(transform.getTransform());
                }
            }
        }

        for (const extName in material.extensions) {
            if(!this[extName]) continue;

            const ext = material.extensions[extName];
            this[extName] = ext;
            
            for(const texName in ext) {
                if(texName.endsWith('Texture')){
                    const texture = ext[texName];
                    if(texture) {
                        this[extName][`${texName}UVSet`] = texture.texCoord;
                        
                        const { KHR_texture_transform: transform } = texture.extensions;
                        if(transform){
                            if(transform.texCoord !== undefined) this[extName][`${texName}UVSet`] = transform.texCoord;
                            this[extName][`${texName}UVTransform`] = UBO.std140Mat3(transform.getTransform());
                        }
                        this.textures[`${extName}.${texName}`] = texture;
                    }
                    
                }
            }
        }

        this.doubleSided = doubleSided;
        this.alphaMode   = alphaMode || 'OPAQUE';

        this.upload();
    }
}
export default Material;
