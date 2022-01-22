import { UBO } from './ubo.js';

const GL = WebGL2RenderingContext;

function capitalizeFirst(str) {
    return str.slice(0, 1).toUpperCase() + str.slice(1);
}

function textureUniformName(name) {
    return `u_${capitalizeFirst(name).replace(/Texture$/, '')}`;
}

function textureSamplerUniform(name) {
    return `${textureUniformName(name)}Sampler`;
}

export class MaterialUBO extends UBO {
    static location = 3;
    
    static layout = new UBO.Layout([
        { name: 'u_AlphaCutoff',                   type: GL.FLOAT      },
        { name: 'u_AttenuationColor',              type: GL.FLOAT_VEC3 },
        { name: 'u_AttenuationDistance',           type: GL.FLOAT      },
        { name: 'u_BaseColorFactor',               type: GL.FLOAT_VEC4 },
        { name: 'u_BaseColorUVSet',                type: GL.INT        },
        { name: 'u_BaseColorUVTransform',          type: GL.FLOAT_MAT3 },
        { name: 'u_ClearcoatFactor',               type: GL.FLOAT      },
        { name: 'u_ClearcoatNormalScale',          type: GL.FLOAT      },
        { name: 'u_ClearcoatNormalUVSet',          type: GL.INT        },
        { name: 'u_ClearcoatNormalUVTransform',    type: GL.FLOAT_MAT3 },
        { name: 'u_ClearcoatRoughnessFactor',      type: GL.FLOAT      },
        { name: 'u_ClearcoatRoughnessUVSet',       type: GL.INT        },
        { name: 'u_ClearcoatRoughnessUVTransform', type: GL.FLOAT_MAT3 },
        { name: 'u_ClearcoatUVSet',                type: GL.INT        },
        { name: 'u_ClearcoatUVTransform',          type: GL.FLOAT_MAT3 },
        { name: 'u_DiffuseFactor',                 type: GL.FLOAT_VEC4 },
        { name: 'u_DiffuseUVSet',                  type: GL.INT        },
        { name: 'u_DiffuseUVTransform',            type: GL.FLOAT_MAT3 },
        { name: 'u_EmissiveFactor',                type: GL.FLOAT_VEC3 },
        { name: 'u_EmissiveUVSet',                 type: GL.INT        },
        { name: 'u_EmissiveUVTransform',           type: GL.FLOAT_MAT3 },
        { name: 'u_GlossinessFactor',              type: GL.FLOAT      },
        { name: 'u_Ior',                           type: GL.FLOAT      },
        { name: 'u_MetallicFactor',                type: GL.FLOAT      },
        { name: 'u_MetallicRoughnessUVSet',        type: GL.INT        },
        { name: 'u_MetallicRoughnessUVTransform',  type: GL.FLOAT_MAT3 },
        { name: 'u_NormalScale',                   type: GL.FLOAT      },
        { name: 'u_NormalUVSet',                   type: GL.INT        },
        { name: 'u_NormalUVTransform',             type: GL.FLOAT_MAT3 },
        { name: 'u_OcclusionStrength',             type: GL.FLOAT      },
        { name: 'u_OcclusionUVSet',                type: GL.INT        },
        { name: 'u_OcclusionUVTransform',          type: GL.FLOAT_MAT3 },
        { name: 'u_RoughnessFactor',               type: GL.FLOAT      },
        { name: 'u_ScreenSize',                    type: GL.INT_VEC2   },
        { name: 'u_SheenColorFactor',              type: GL.FLOAT_VEC3 },
        { name: 'u_SheenColorUVSet',               type: GL.INT        },
        { name: 'u_SheenColorUVTransform',         type: GL.FLOAT_MAT3 },
        { name: 'u_SheenRoughnessFactor',          type: GL.FLOAT      },
        { name: 'u_SheenRoughnessUVSet',           type: GL.INT        },
        { name: 'u_SheenRoughnessUVTransform',     type: GL.FLOAT_MAT3 },
        { name: 'u_SpecularColorUVSet',            type: GL.INT        },
        { name: 'u_SpecularColorUVTransform',      type: GL.FLOAT_MAT3 },
        { name: 'u_SpecularFactor',                type: GL.FLOAT_VEC3 },
        { name: 'u_SpecularGlossinessUVSet',       type: GL.INT        },
        { name: 'u_SpecularGlossinessUVTransform', type: GL.FLOAT_MAT3 },
        { name: 'u_SpecularUVSet',                 type: GL.INT        },
        { name: 'u_SpecularUVTransform',           type: GL.FLOAT_MAT3 },
        { name: 'u_ThicknessFactor',               type: GL.FLOAT      },
        { name: 'u_ThicknessUVSet',                type: GL.INT        },
        { name: 'u_ThicknessUVTransform',          type: GL.FLOAT_MAT3 },
        { name: 'u_TransmissionFactor',            type: GL.FLOAT      },
        { name: 'u_TransmissionUVSet',             type: GL.INT        },
        { name: 'u_TransmissionUVTransform',       type: GL.FLOAT_MAT3 },

        { name: 'u_KHR_materials_specular_specularColorFactor', type: GL.FLOAT_VEC3 },
        { name: 'u_KHR_materials_specular_specularFactor',      type: GL.FLOAT      },
    ]);
    
    constructor(context, material = {}) {
        super(context);

        this.material = material;

        const {
            pbrMetallicRoughness = {},
            normalTexture, occlusionTexture, emissiveTexture, emissiveFactor, doubleSided, alphaMode, alphaCutoff
        } = material;

        const {
            baseColorFactor = [1, 1, 1, 1], metallicFactor = 1, roughnessFactor = 1, baseColorTexture, metallicRoughnessTexture
        } = pbrMetallicRoughness;

        this.textures = { normalTexture, occlusionTexture, emissiveTexture, baseColorTexture, metallicRoughnessTexture };


        const uniforms = {
            u_BaseColorFactor:   baseColorFactor,
            u_MetallicFactor:    metallicFactor,
            u_RoughnessFactor:   roughnessFactor,
            u_EmissiveFactor:    emissiveFactor,
            u_AlphaCutoff:       alphaCutoff,
            u_NormalScale:       normalTexture?.scale,
            u_OcclusionStrength: occlusionTexture?.strength
        };

        for (const extName in material.extensions) {
            const ext = material.extensions[extName];
            for(const [field, uniformName] of Object.entries(ext.constructor.uniformFields)) {
                uniforms[uniformName] = ext[field];
            }
            for(const field of ext.constructor.textureFields) {
                this.textures[field] = ext[field];
            }
        }

        for (const name in this.textures) {
            const texture = this.textures[name];
            if (texture) {
                const uniformName = textureUniformName(name);

                uniforms[`${uniformName}UVSet`] = texture.texCoord;

                const { KHR_texture_transform } = texture.extensions;
                if(KHR_texture_transform){
                    if(KHR_texture_transform.texCoord !== undefined) uniforms[`${uniformName}UVSet`] = KHR_texture_transform.texCoord;
                    uniforms[`${uniformName}UVTransform`] = KHR_texture_transform.getTransformMat4();
                }
            }
        }

        this.doubleSided = doubleSided;
        this.alphaMode   = alphaMode;

        this.set(uniforms);
        this.upload();
    }

    bind(program) {
        const { context: gl } = this;

        for(const name in this.textures) {
            if(this.textures[name]) program.samplers.set(textureSamplerUniform(name), this.textures[name].getWebGLTexture(gl));
        }

        if (this.doubleSided) {
            gl.disable(gl.CULL_FACE);
        } else {
            gl.enable(gl.CULL_FACE);
        }

        if (this.alphaMode === 'BLEND') {
            gl.enable(gl.BLEND);
            gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.blendEquation(gl.FUNC_ADD);
        } else {
            gl.disable(gl.BLEND);
        }

        super.bind();
    }
}
export default MaterialUBO;
