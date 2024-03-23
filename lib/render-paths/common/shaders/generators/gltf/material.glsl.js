import { Material } from '../../../../../material.js';

/**
 * @param {import('../../shader.js').ShaderInitialized<import('../../gltf-shader.js').GLTFShader>} shader
 */
export function generate({ flags, locations }) {
    /**
     * Returns a block of shader code with the UV coordinates for a specific texture, taking into account any KHR_texture_transform.
     * @param {string} name
     */
    const textureUVBlock = (name) => {
        let uv = /* glsl */`material.${name}UVSet == 1 ? v_texCoord.zw : v_texCoord.xy`;
        if(flags.hasTransform?.[name]) uv = /* glsl */`(material.${name}UVTransform * vec3(${uv}, 1.0)).xy`;
        return uv;
    }

    /**
     * Returns a block of shader code to sample a texture or a default value if not used for this material.
     * @param {string} name
     * @param {string} [defaultValue]
     */
    const textureSampleBlock = (name, defaultValue = /* glsl */`vec4(1.0)`) => {
        if(!flags.hasTexture?.[name]) return defaultValue;
        const tex = name.replace(/\./g, '_');
        return /* glsl */`texture(${tex}, ${textureUVBlock(name)})`;
    }

    const code = /* glsl */`
        ${Material.generateUniformBlock('glsl', 3, locations.material)}

        ${Object.keys(locations.textures ?? {}).map(name => {
            const tex = name.replace(/\./g, '_');
            const loc = locations.textures[/** @type {keyof locations['textures']} */(name)];
            return /* glsl */`
            #pragma revTextureBinding(${tex}, 3, ${loc}, ${loc + 1})
            uniform sampler2D ${tex};
            `
        }).join('\n        ')}

        struct NormalInfo {
            vec3 v; //normalized frustum.position - v_position
            vec3 ng;
            vec3 n;
            vec3 t;
            vec3 b;
            vec3 scale;
        };

        NormalInfo getNormalInfo() {
            vec3 v     = normalize(frustum.position - v_position);

            vec2 UV    = ${textureUVBlock('normalTexture')};
            vec3 uv_dx = dFdx(vec3(UV, 0.0));
            vec3 uv_dy = dFdy(vec3(UV, 0.0));

            if(length(uv_dx) <= 1e-2) {
                uv_dx = vec3(1.0, 0.0, 0.0);
            }

            if(length(uv_dy) <= 1e-2) {
                uv_dy = vec3(0.0, 1.0, 0.0);
            }

            vec3 pos_dx = dFdx(v_position);
            vec3 pos_dy = dFdy(v_position);

            vec3 t_ = (uv_dy[1] * pos_dx - uv_dx[1] * pos_dy) /
                (uv_dx[0] * uv_dy[1] - uv_dy[0] * uv_dx[1]);

            vec3 n;
            vec3 t;
            vec3 b;
            vec3 ng;

            // Compute geometrical TBN:
            ${flags.hasAttr['TANGENT'] ? /* glsl */`
                ng = normalize(v_modelInfo0.xyz);
                t  = normalize(v_modelInfo1.xyz);
                b  = normalize(v_modelInfo2.xyz);
            `: /* glsl */`
            // Normals are either present as vertex attributes or approximated.
                ${flags.hasAttr['NORMAL'] ? /* glsl */`
                    ng = normalize(v_modelInfo0.xyz);
                `: /* glsl */`
                    ng = normalize(cross(pos_dx, pos_dy));
                `}

                t = normalize(t_ - ng * dot(ng, t_));
                b = cross(ng, t);
            `}

            // For a back-facing surface, the tangential basis vectors are negated.
            if (gl_FrontFacing == false) {
                t  = t * -1.0;
                b  = b * -1.0;
            }

            // Compute pertubed normals:
            ${flags.hasTexture?.normalTexture ? /* glsl */`
                n = texture(normalTexture, UV).rgb * 2.0 - vec3(1.0);
                n = n * vec3(material.normalTextureScale, material.normalTextureScale, 1.0);
                n = mat3(t, b, ng) * normalize(n);
            ` : /* glsl */`
                n = ng;
            `}

            NormalInfo normalInfo;
            normalInfo.v  = v;
            normalInfo.ng = ng;
            normalInfo.t  = t;
            normalInfo.b  = n;
            normalInfo.n  = n;
            normalInfo.scale = vec3(v_modelInfo0.w, v_modelInfo1.w, v_modelInfo2.w);
            return normalInfo;
        }

        NormalInfo normalInfo;

        struct MaterialInfo {
            vec4  baseColor;
            vec3  emissive;
            float occlusion;

            float ior;
            vec3  f0;
            vec3  f90;

            float metallic;
            float perceptualRoughness;
            float alphaRoughness;


            vec3  c_diff;

            float sheenRoughnessFactor;
            vec3  sheenColorFactor;

            vec3  clearcoatF0;
            vec3  clearcoatF90;
            float clearcoatFactor;
            vec3  clearcoatFresnel;
            vec3  clearcoatNormal;
            float clearcoatRoughness;

            float specularWeight;

            float transmissionFactor;

            float thickness;
            vec3  attenuationColor;
            float attenuationDistance;

            vec3  iridescenceF0;
            vec3  iridescenceFresnel;
            float iridescenceFactor;
            float iridescenceIor;
            float iridescenceThickness;
        };

        vec4 getVertexColor(){
            vec4 color = vec4(1.0);

            ${flags.hasAttr['COLOR_0'] ? /* glsl */`
                ${flags.hasColor0Vec3 ? /* glsl */`
                    color = vec4(v_color0, 1.0);
                `: /* glsl */`
                    color = v_color0;
                `}
            `: ''}

            return color;
        }

        vec4 getBaseColor() {
            vec4 baseColor = vec4(1.0);

            ${!flags.hasExtension?.KHR_materials_pbrSpecularGlossiness ? /* glsl */`
                baseColor = material.baseColorFactor;
                baseColor = baseColor * ${textureSampleBlock('baseColorTexture')};
            `: /* glsl */`
                baseColor = material.KHR_materials_pbrSpecularGlossiness.diffuseFactor;
                baseColor = baseColor * ${textureSampleBlock('KHR_materials_pbrSpecularGlossiness.diffuseTexture')};
            `}

            baseColor = baseColor * getVertexColor();

            ${flags.isOpaque ? /* glsl */`
                baseColor.a = 1.0;
            `: ''}

            ${flags.isMask ? /* wgsl */`
                baseColor.a = baseColor.a < material.alphaCutoff ? 0.0 : 1.0;
            ` : ''}

            return baseColor;
        }

        MaterialInfo getMaterialInfo() {
            MaterialInfo materialInfo;

            materialInfo.baseColor = getBaseColor();
            materialInfo.emissive  = material.emissiveFactor * ${textureSampleBlock('emissiveTexture')}.rgb;
            materialInfo.occlusion = ${textureSampleBlock('occlusionTexture')}.r;

            materialInfo.ior = 1.5;
            materialInfo.f0  = vec3(0.04);
            materialInfo.f90 = vec3(1.0);
            materialInfo.specularWeight = 1.0;

            ${flags.hasExtension?.KHR_materials_ior ? /* glsl */`
                //Ior
                materialInfo.f0 = vec3(pow((material.KHR_materials_ior.ior - 1.0) /  (material.KHR_materials_ior.ior  + 1.0), 2.0));
                materialInfo.ior = material.KHR_materials_ior.ior ;
            `: ''}

            ${flags.hasExtension?.KHR_materials_emissive_strength ? /* glsl */`
                //Emissive Strength
                materialInfo.emissive = materialInfo.emissive * material.KHR_materials_emissive_strength.emissiveStrength;
            `: ''}

            ${!flags.hasExtension?.KHR_materials_pbrSpecularGlossiness ? /* glsl */`
                //Metallic Roughness
                materialInfo.metallic            = material.metallicFactor;
                materialInfo.perceptualRoughness = material.roughnessFactor;

                ${flags.hasTexture?.metallicRoughnessTexture ? /* glsl */`
                    vec4 mrSample = ${textureSampleBlock('metallicRoughnessTexture')};
                    materialInfo.perceptualRoughness = materialInfo.perceptualRoughness * mrSample.g;
                    materialInfo.metallic            = materialInfo.metallic * mrSample.b;
                `: ''}

                materialInfo.c_diff = mix(materialInfo.baseColor.rgb * (vec3(1.0) - materialInfo.f0),  vec3(0.0), materialInfo.metallic);
                materialInfo.f0     = mix(materialInfo.f0, materialInfo.baseColor.rgb, materialInfo.metallic);

            ` : /* glsl */`
                // Specular Glossiness
                materialInfo.f0                  = material.KHR_materials_pbrSpecularGlossiness.specularFactor;
                materialInfo.perceptualRoughness = material.KHR_materials_pbrSpecularGlossiness.glossinessFactor;

                ${flags.hasTexture?.['KHR_materials_pbrSpecularGlossiness.specularGlossinessTexture'] ? /* glsl */`
                    vec4 sgSample = ${textureSampleBlock('KHR_materials_pbrSpecularGlossiness.specularGlossinessTexture')};
                    materialInfo.perceptualRoughness = materialInfo.perceptualRoughness * sgSample.a ; // glossiness to roughness
                    materialInfo.f0                  = materialInfo.f0 * sgSample.rgb; // specular
                `: ''}

                materialInfo.perceptualRoughness = 1.0 - materialInfo.perceptualRoughness; // 1 - glossiness
                materialInfo.c_diff              = materialInfo.baseColor.rgb * (1.0 - max(max(materialInfo.f0.r, materialInfo.f0.g), materialInfo.f0.b));

            `}

            ${flags.hasExtension?.KHR_materials_clearcoat ? /* glsl */`
                //Clearcoat
                materialInfo.clearcoatFactor    = material.KHR_materials_clearcoat.clearcoatFactor * ${textureSampleBlock('KHR_materials_clearcoat.clearcoatTexture')}.r;
                materialInfo.clearcoatRoughness = material.KHR_materials_clearcoat.clearcoatRoughnessFactor * ${textureSampleBlock('KHR_materials_clearcoat.clearcoatRoughnessTexture')}.g;
                materialInfo.clearcoatF0        = vec3(pow((materialInfo.ior - 1.0) / (materialInfo.ior + 1.0), 2.0));
                materialInfo.clearcoatF90       = vec3(1.0);

                ${flags.hasTexture?.['KHR_materials_clearcoat.clearcoatNormalTexture'] ? /* glsl */`
                    vec3 n = ${textureSampleBlock('KHR_materials_clearcoat.clearcoatNormalTexture')}.rgb * 2.0 - vec3(1.0);
                    n = n * vec3(material.KHR_materials_clearcoat.clearcoatNormalTextureScale, material.KHR_materials_clearcoat.clearcoatNormalTextureScale, 1.0);
                    n = mat3(normalInfo.t, normalInfo.b, normalInfo.ng) * normalize(n);
                    materialInfo.clearcoatNormal = n;
                `: /* glsl */`
                    materialInfo.clearcoatNormal = normalInfo.ng;
                `}

                materialInfo.clearcoatFresnel = F_Schlick_3(materialInfo.clearcoatF0, materialInfo.clearcoatF90, clampedDot(materialInfo.clearcoatNormal, normalInfo.v));
            `: '' }

            ${flags.hasExtension?.KHR_materials_specular ? /* glsl */`
                //Specular
                vec4 specularTexture = vec4(1.0);

                ${flags.hasTexture['KHR_materials_specular.specularTexture'] ? /* glsl */`
                    specularTexture.a = ${textureSampleBlock('KHR_materials_specular.specularTexture')}.a;
                `: ''}
                ${flags.hasTexture['KHR_materials_specular.specularColorTexture'] ? /* glsl */`
                    specularTexture = vec4(${textureSampleBlock('KHR_materials_specular.specularColorTexture')}.rgb, specularTexture.a);
                `: ''}

                vec3 dielectricSpecularF0   = min(materialInfo.f0 * material.KHR_materials_specular.specularColorFactor * specularTexture.rgb, vec3(1.0));
                materialInfo.f0             = mix(dielectricSpecularF0, materialInfo.baseColor.rgb, materialInfo.metallic);
                materialInfo.specularWeight = material.KHR_materials_specular.specularFactor * specularTexture.a;
                materialInfo.c_diff         = mix(materialInfo.baseColor.rgb * (1.0 - max3(dielectricSpecularF0)),  vec3(0.0), materialInfo.metallic);
            `: '' }

            ${flags.hasExtension?.KHR_materials_sheen ? /* glsl */`
                //Sheen
                materialInfo.sheenColorFactor     = material.KHR_materials_sheen.sheenColorFactor * ${textureSampleBlock('KHR_materials_sheen.sheenColorTexture')}.rgb;
                materialInfo.sheenRoughnessFactor = material.KHR_materials_sheen.sheenRoughnessFactor * ${textureSampleBlock('KHR_materials_sheen.sheenRoughnessTexture')}.a;
            `: '' }

            ${flags.hasExtension?.KHR_materials_transmission ? /* glsl */`
                //Transmission
                materialInfo.transmissionFactor = material.KHR_materials_transmission.transmissionFactor;

                ${flags.hasTexture['KHR_materials_transmission.transmissionTexture'] ? /* glsl */`
                    vec4 transmissionSample =  ${textureSampleBlock('KHR_materials_transmission.transmissionTexture')};
                    materialInfo.transmissionFactor = materialInfo.transmissionFactor * transmissionSample.r;
                `: ''}
            `: ''}

            ${flags.hasExtension?.KHR_materials_volume ? /* glsl */`
                //Volume
                materialInfo.thickness           = material.KHR_materials_volume.thicknessFactor;
                materialInfo.attenuationColor    = material.KHR_materials_volume.attenuationColor;
                materialInfo.attenuationDistance = material.KHR_materials_volume.attenuationDistance;

                ${flags.hasTexture['KHR_materials_volume.thicknessTexture'] ? /* glsl */`
                    vec4 thicknessSample =  ${textureSampleBlock('KHR_materials_volume.thicknessTexture')};
                    materialInfo.thickness = materialInfo.thickness * thicknessSample.g;
                `: ''}
            `: ''}

            ${flags.hasExtension?.KHR_materials_iridescence ? /* glsl */`
                //Iridescence
                materialInfo.iridescenceIor       = material.KHR_materials_iridescence.iridescenceIor;
                materialInfo.iridescenceThickness = material.KHR_materials_iridescence.iridescenceThicknessMaximum;

                ${flags.hasTexture['KHR_materials_iridescence.iridescenceThicknessTexture'] ? /* glsl */`
                    float thickness = ${textureSampleBlock('KHR_materials_iridescence.iridescenceThicknessTexture')}.g;
                    materialInfo.iridescenceThickness = mix(material.KHR_materials_iridescence.iridescenceThicknessMinimum, material.KHR_materials_iridescence.iridescenceThicknessMaximum, thickness);
                `: ''}

                materialInfo.iridescenceFactor = materialInfo.iridescenceThickness == 0.0 ? 0.0 : material.KHR_materials_iridescence.iridescenceFactor;

                ${flags.hasTexture['KHR_materials_iridescence.iridescenceTexture'] ? /* glsl */`
                    materialInfo.iridescenceFactor =  materialInfo.iridescenceFactor * ${textureSampleBlock('KHR_materials_iridescence.iridescenceTexture')}.r;
                `: ''}

                materialInfo.iridescenceFresnel = materialInfo.f0;
                materialInfo.iridescenceF0      = materialInfo.f0;

                if (materialInfo.iridescenceFactor > 0.0) {
                    float NdotV = clampedDot(normalInfo.n, normalInfo.v);
                    materialInfo.iridescenceFresnel = evalIridescence(1.0, materialInfo.iridescenceIor, NdotV, materialInfo.iridescenceThickness, materialInfo.f0);
                    materialInfo.iridescenceF0      = Schlick_to_F0_3(materialInfo.iridescenceFresnel, vec3(1.0), NdotV);
                }
            `: ''}

            //Standard
            materialInfo.perceptualRoughness = clamp(materialInfo.perceptualRoughness, 0.0, 1.0);
            materialInfo.metallic            = clamp(materialInfo.metallic, 0.0, 1.0);
            materialInfo.alphaRoughness      = materialInfo.perceptualRoughness * materialInfo.perceptualRoughness;

            return materialInfo;
        }

        MaterialInfo materialInfo;

    `;

    return code;
}

export default generate;
