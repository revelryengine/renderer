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
        let uv = /* wgsl */`select(in.texCoord.xy, in.texCoord.zw, material.${name}UVSet == 1)`;
        if(flags.hasTransform?.[name]) uv = /* wgsl */`(material.${name}UVTransform * vec3<f32>(${uv}, 1.0)).xy`;
        return uv;
    }

    /**
     * Returns a block of shader code to sample a texture or a default value if not used for this material.
     * @param {string} name
     * @param {string} [defaultValue]
     */
    const textureSampleBlock = (name, defaultValue = /* wgsl */`vec4<f32>(1.0)`) => {
        if(!flags.hasTexture?.[name]) return defaultValue;
        const tex = name.replace(/\./g, '_');
        return /* wgsl */`textureSample(${tex}, ${tex}Sampler, ${textureUVBlock(name)})`;
    }

    const code = /*wgsl */`

        ${Material.generateUniformBlock('wgsl', 3, locations.material)}

        ${Object.keys(locations.textures ?? {}).map(name => {
            const tex = name.replace(/\./g, '_');
            const loc = locations.textures[/** @type {keyof locations['textures']} */(name)];
            return /* wgsl */`
            @group(3) @binding(${loc}) var ${tex}: texture_2d<f32>;
            @group(3) @binding(${loc + 1}) var ${tex}Sampler: sampler;
            `
        }).join('\n        ')}

        struct NormalInfo {
            v:  vec3<f32>, //normalized frustum.position - in.position
            ng: vec3<f32>,
            n:  vec3<f32>,
            t:  vec3<f32>,
            b:  vec3<f32>,
            scale: vec3<f32>,
        };

        fn getNormalInfo() -> NormalInfo {
            var v     = normalize(frustum.position - in.position);

            var UV    = ${textureUVBlock('normalTexture')};
            var uv_dx = dpdx(vec3<f32>(UV, 0.0));
            var uv_dy = -dpdy(vec3<f32>(UV, 0.0));

            if(length(uv_dx) <= 1e-2) {
                uv_dx = vec3<f32>(1.0, 0.0, 0.0);
            }

            if(length(uv_dy) <= 1e-2) {
                uv_dy = vec3<f32>(0.0, 1.0, 0.0);
            }

            var pos_dx = dpdx(in.position);
            var pos_dy = -dpdy(in.position);

            var t_ = (uv_dy[1] * pos_dx - uv_dx[1] * pos_dy) /
                (uv_dx[0] * uv_dy[1] - uv_dy[0] * uv_dx[1]);

            var n  : vec3<f32>;
            var t  : vec3<f32>;
            var b  : vec3<f32>;
            var ng : vec3<f32>;

            // Compute geometrical TBN:
            ${flags.hasAttr['TANGENT'] ? /* wgsl */`
                ng = normalize(in.modelInfo0.xyz);
                t  = normalize(in.modelInfo1.xyz);
                b  = normalize(in.modelInfo2.xyz);
            `: /* wgsl */`
            // Normals are either present as vertex attributes or approximated.
                ${flags.hasAttr['NORMAL'] ? /* wgsl */`
                    ng = normalize(in.modelInfo0.xyz);
                `: /* wgsl */`
                    ng = normalize(cross(pos_dx, pos_dy));
                `}

                t = normalize(t_ - ng * dot(ng, t_));
                b = cross(ng, t);
            `}

            // For a back-facing surface, the tangential basis vectors are negated.
            if (in.frontFacing == false) {
                t  = t * -1.0;
                b  = b * -1.0;
            }

            // Compute pertubed normals:
            ${flags.hasTexture?.normalTexture ? /* wgsl */`
                n = textureSample(normalTexture, normalTextureSampler, UV).rgb * 2.0 - vec3<f32>(1.0);
                n = n * vec3<f32>(material.normalTextureScale, material.normalTextureScale, 1.0);
                n = mat3x3<f32>(t, b, ng) * normalize(n);
            ` : /* wgsl */`
                n = ng;
            `}

            var normalInfo: NormalInfo;
            normalInfo.v  = v;
            normalInfo.ng = ng;
            normalInfo.t  = t;
            normalInfo.b  = n;
            normalInfo.n  = n;
            normalInfo.scale = vec3<f32>(in.modelInfo0.w, in.modelInfo1.w, in.modelInfo2.w);
            return normalInfo;
        }
        var<private> normalInfo:   NormalInfo;

        struct MaterialInfo {
            baseColor : vec4<f32>,
            emissive  : vec3<f32>,
            occlusion : f32,

            ior : f32,
            f0  : vec3<f32>,
            f90 : vec3<f32>,

            metallic            : f32,
            perceptualRoughness : f32,
            alphaRoughness      : f32,

            c_diff : vec3<f32>,

            sheenRoughnessFactor : f32,
            sheenColorFactor     : vec3<f32>,

            clearcoatF0        : vec3<f32>,
            clearcoatF90       : vec3<f32>,
            clearcoatFactor    : f32,
            clearcoatFresnel   : vec3<f32>,
            clearcoatNormal    : vec3<f32>,
            clearcoatRoughness : f32,

            specularWeight : f32,

            transmissionFactor : f32,

            thickness           : f32,
            attenuationColor    : vec3<f32>,
            attenuationDistance : f32,

            iridescenceF0        : vec3<f32>,
            iridescenceFresnel   : vec3<f32>,
            iridescenceFactor    : f32,
            iridescenceIor       : f32,
            iridescenceThickness : f32,
        };

        fn getVertexColor() -> vec4<f32>{
            var color = vec4<f32>(1.0);

            ${flags.hasAttr['COLOR_0'] ? /* wgsl */`
                ${flags.hasColor0Vec3 ? /* wgsl */`
                    color = vec4<f32>(in.color0, 1.0);
                `: /* wgsl */`
                    color = in.color0;
                `}
            `: ''}

            return color;
        }

        fn getBaseColor() -> vec4<f32> {
            var baseColor = vec4<f32>(1.0);

            ${!flags.hasExtension?.KHR_materials_pbrSpecularGlossiness ? /* wgsl */`
                baseColor = material.baseColorFactor;
                baseColor = baseColor * ${textureSampleBlock('baseColorTexture')};
            `: /* wgsl */`
                baseColor = material.KHR_materials_pbrSpecularGlossiness.diffuseFactor;
                baseColor = baseColor * ${textureSampleBlock('KHR_materials_pbrSpecularGlossiness.diffuseTexture')};
            `}

            baseColor = baseColor * getVertexColor();

            ${flags.isOpaque ? /* wgsl */`
                baseColor.a = 1.0;
            `: ''}

            ${flags.isMask ? /* wgsl */`
                baseColor.a = select(1.0, 0.0, baseColor.a < material.alphaCutoff);
            ` : ''}

            return baseColor;
        }

        fn getMaterialInfo() -> MaterialInfo {
            var materialInfo: MaterialInfo;

            materialInfo.baseColor = getBaseColor();
            materialInfo.emissive  = material.emissiveFactor * ${textureSampleBlock('emissiveTexture')}.rgb;
            materialInfo.occlusion = ${textureSampleBlock('occlusionTexture')}.r;

            materialInfo.ior = 1.5;
            materialInfo.f0  = vec3<f32>(0.04);
            materialInfo.f90 = vec3<f32>(1.0);
            materialInfo.specularWeight = 1.0;

            ${flags.hasExtension?.KHR_materials_ior ? /* wgsl */`
                //Ior
                materialInfo.f0 = vec3<f32>(pow((material.KHR_materials_ior.ior - 1.0) /  (material.KHR_materials_ior.ior  + 1.0), 2.0));
                materialInfo.ior = material.KHR_materials_ior.ior ;
            `: ''}

            ${flags.hasExtension?.KHR_materials_emissive_strength ? /* wgsl */`
                //Emissive Strength
                materialInfo.emissive = materialInfo.emissive * material.KHR_materials_emissive_strength.emissiveStrength;
            `: ''}

            ${!flags.hasExtension?.KHR_materials_pbrSpecularGlossiness ? /* wgsl */`
                // Metallic Roughness
                materialInfo.metallic            = material.metallicFactor;
                materialInfo.perceptualRoughness = material.roughnessFactor;

                ${flags.hasTexture?.metallicRoughnessTexture ? /* wgsl */`
                    var mrSample = ${textureSampleBlock('metallicRoughnessTexture')};
                    materialInfo.perceptualRoughness = materialInfo.perceptualRoughness * mrSample.g;
                    materialInfo.metallic            = materialInfo.metallic * mrSample.b;
                `: ''}

                materialInfo.c_diff = mix(materialInfo.baseColor.rgb * (vec3<f32>(1.0) - materialInfo.f0),  vec3<f32>(0.0), materialInfo.metallic);
                materialInfo.f0     = mix(materialInfo.f0, materialInfo.baseColor.rgb, materialInfo.metallic);

            ` : /* wgsl */`
                // Specular Glossiness
                materialInfo.f0                  = material.KHR_materials_pbrSpecularGlossiness.specularFactor;
                materialInfo.perceptualRoughness = material.KHR_materials_pbrSpecularGlossiness.glossinessFactor;

                ${flags.hasTexture?.['KHR_materials_pbrSpecularGlossiness.specularGlossinessTexture'] ? /* wgsl */`
                    var sgSample = ${textureSampleBlock('KHR_materials_pbrSpecularGlossiness.specularGlossinessTexture')};
                    materialInfo.perceptualRoughness = materialInfo.perceptualRoughness * sgSample.a ; // glossiness to roughness
                    materialInfo.f0                  = materialInfo.f0 * sgSample.rgb; // specular
                `: ''}

                materialInfo.perceptualRoughness = 1.0 - materialInfo.perceptualRoughness; // 1 - glossiness
                materialInfo.c_diff              = materialInfo.baseColor.rgb * (1.0 - max(max(materialInfo.f0.r, materialInfo.f0.g), materialInfo.f0.b));

            `}

            ${flags.hasExtension?.KHR_materials_clearcoat ? /* wgsl */`
                //Clearcoat
                materialInfo.clearcoatFactor    = material.KHR_materials_clearcoat.clearcoatFactor * ${textureSampleBlock('KHR_materials_clearcoat.clearcoatTexture')}.r;
                materialInfo.clearcoatRoughness = material.KHR_materials_clearcoat.clearcoatRoughnessFactor * ${textureSampleBlock('KHR_materials_clearcoat.clearcoatRoughnessTexture')}.g;
                materialInfo.clearcoatF0        = vec3<f32>(pow((materialInfo.ior - 1.0) / (materialInfo.ior + 1.0), 2.0));
                materialInfo.clearcoatF90       = vec3<f32>(1.0);

                ${flags.hasTexture?.['KHR_materials_clearcoat.clearcoatNormalTexture'] ? /* wgsl */`
                    var n = ${textureSampleBlock('KHR_materials_clearcoat.clearcoatNormalTexture')}.rgb * 2.0 - vec3<f32>(1.0);
                    n = n * vec3<f32>(material.KHR_materials_clearcoat.clearcoatNormalTextureScale, material.KHR_materials_clearcoat.clearcoatNormalTextureScale, 1.0);
                    n = mat3x3<f32>(normalInfo.t, normalInfo.b, normalInfo.ng) * normalize(n);
                    materialInfo.clearcoatNormal = n;
                `: /* wgsl */`
                    materialInfo.clearcoatNormal = normalInfo.ng;
                `}

                materialInfo.clearcoatFresnel = F_Schlick_3(materialInfo.clearcoatF0, materialInfo.clearcoatF90, clampedDot(materialInfo.clearcoatNormal, normalInfo.v));
            `: '' }

            ${flags.hasExtension?.KHR_materials_specular ? /* wgsl */`
                //Specular
                var specularTexture = vec4<f32>(1.0);

                ${flags.hasTexture['KHR_materials_specular.specularTexture'] ? /* wgsl */`
                    specularTexture.a = ${textureSampleBlock('KHR_materials_specular.specularTexture')}.a;
                `: ''}
                ${flags.hasTexture['KHR_materials_specular.specularColorTexture'] ? /* wgsl */`
                    specularTexture = vec4<f32>(${textureSampleBlock('KHR_materials_specular.specularColorTexture')}.rgb, specularTexture.a);
                `: ''}

                var dielectricSpecularF0    = min(materialInfo.f0 * material.KHR_materials_specular.specularColorFactor * specularTexture.rgb, vec3<f32>(1.0));
                materialInfo.f0             = mix(dielectricSpecularF0, materialInfo.baseColor.rgb, materialInfo.metallic);
                materialInfo.specularWeight = material.KHR_materials_specular.specularFactor * specularTexture.a;
                materialInfo.c_diff         = mix(materialInfo.baseColor.rgb * (1.0 - max3(dielectricSpecularF0)),  vec3<f32>(0.0), materialInfo.metallic);
            `: '' }

            ${flags.hasExtension?.KHR_materials_sheen ? /* wgsl */`
                //Sheen
                materialInfo.sheenColorFactor     = material.KHR_materials_sheen.sheenColorFactor * ${textureSampleBlock('KHR_materials_sheen.sheenColorTexture')}.rgb;
                materialInfo.sheenRoughnessFactor = material.KHR_materials_sheen.sheenRoughnessFactor * ${textureSampleBlock('KHR_materials_sheen.sheenRoughnessTexture')}.a;
            `: '' }

            ${flags.hasExtension?.KHR_materials_transmission ? /* wgsl */`
                //Transmission
                materialInfo.transmissionFactor = material.KHR_materials_transmission.transmissionFactor;

                ${flags.hasTexture['KHR_materials_transmission.transmissionTexture'] ? /* wgsl */`
                    var transmissionSample =  ${textureSampleBlock('KHR_materials_transmission.transmissionTexture')};
                    materialInfo.transmissionFactor = materialInfo.transmissionFactor * transmissionSample.r;
                `: ''}
            `: ''}

            ${flags.hasExtension?.KHR_materials_volume ? /* wgsl */`
                //Volume
                materialInfo.thickness           = material.KHR_materials_volume.thicknessFactor;
                materialInfo.attenuationColor    = material.KHR_materials_volume.attenuationColor;
                materialInfo.attenuationDistance = material.KHR_materials_volume.attenuationDistance;

                ${flags.hasTexture['KHR_materials_volume.thicknessTexture'] ? /* wgsl */`
                    var thicknessSample =  ${textureSampleBlock('KHR_materials_volume.thicknessTexture')};
                    materialInfo.thickness = materialInfo.thickness * thicknessSample.g;
                `: ''}
            `: ''}

            ${flags.hasExtension?.KHR_materials_iridescence ? /* wgsl */`
                //Iridescence
                materialInfo.iridescenceIor       = material.KHR_materials_iridescence.iridescenceIor;
                materialInfo.iridescenceThickness = material.KHR_materials_iridescence.iridescenceThicknessMaximum;

                ${flags.hasTexture['KHR_materials_iridescence.iridescenceThicknessTexture'] ? /* wgsl */`
                    var thickness = ${textureSampleBlock('KHR_materials_iridescence.iridescenceThicknessTexture')}.g;
                    materialInfo.iridescenceThickness = mix(material.KHR_materials_iridescence.iridescenceThicknessMinimum, material.KHR_materials_iridescence.iridescenceThicknessMaximum, thickness);
                `: ''}

                materialInfo.iridescenceFactor = select(material.KHR_materials_iridescence.iridescenceFactor, 0.0, materialInfo.iridescenceThickness == 0.0);

                ${flags.hasTexture['KHR_materials_iridescence.iridescenceTexture'] ? /* wgsl */`
                    materialInfo.iridescenceFactor =  materialInfo.iridescenceFactor * ${textureSampleBlock('KHR_materials_iridescence.iridescenceTexture')}.r;
                `: ''}

                materialInfo.iridescenceFresnel = materialInfo.f0;
                materialInfo.iridescenceF0      = materialInfo.f0;

                if (materialInfo.iridescenceFactor > 0.0) {
                    var NdotV = clampedDot(normalInfo.n, normalInfo.v);
                    materialInfo.iridescenceFresnel = evalIridescence(1.0, materialInfo.iridescenceIor, NdotV, materialInfo.iridescenceThickness, materialInfo.f0);
                    materialInfo.iridescenceF0      = Schlick_to_F0_3(materialInfo.iridescenceFresnel, vec3<f32>(1.0), NdotV);
                }
            `: ''}

            //Standard
            materialInfo.perceptualRoughness = clamp(materialInfo.perceptualRoughness, 0.0, 1.0);
            materialInfo.metallic            = clamp(materialInfo.metallic, 0.0, 1.0);
            materialInfo.alphaRoughness      = materialInfo.perceptualRoughness * materialInfo.perceptualRoughness;

            return materialInfo;
        }

        var<private> materialInfo: MaterialInfo;
    `;

    return code;
}

export default generate;
