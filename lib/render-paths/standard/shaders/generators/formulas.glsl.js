/**
 * 
 */
const M_PI    = '3.141592653589793';
const GGX     = 0;
const CHARLIE = 1;

export function generate() {
    const code = /* glsl */`
        float saturate(float v) {
            return clamp(v, 0.0, 1.0);
        }

        float clampedDot(vec3 x, vec3 y) {
            return clamp(dot(x, y), 0.0, 1.0);
        }

        vec3 linearTosRGB(vec3 color) {
            return pow(color, vec3(1.0 / 2.2));
        }

        vec4 linearTosRGBA(vec4 color) {
            return pow(color, vec4(1.0 / 2.2));
        }

        float max3(vec3 v) {
            return max(max(v.x, v.y), v.z);
        }

        // Hammersley Points on the Hemisphere
        // CC BY 3.0 (Holger Dammertz)
        // http://holger.dammertz.org/stuff/notes_HammersleyOnHemisphere.html
        // with adapted interface
        float radicalInverse_VdC(uint i) {
            uint bits = i;
            bits = (bits << 16u) | (bits >> 16u);
            bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
            bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
            bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
            bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
            return float(bits) * 2.3283064365386963e-10; // / 0x100000000
        }

        // hammersley2d describes a sequence of points in the 2d unit square [0,1)^2
        // that can be used for quasi Monte Carlo integration
        vec2 hammersley2d(int i, int N) {
            return vec2(float(i)/float(N), radicalInverse_VdC(uint(i)));
        }

        // Hemisphere Sample

        // TBN generates a tangent bitangent normal coordinate frame from the normal
        // (the normal must be normalized)
        mat3 generateTBN(vec3 normal) {
            vec3 bitangent = vec3(0.0, 1.0, 0.0);

            float NdotUp  = dot(normal, vec3(0.0, 1.0, 0.0));
            float epsilon = 0.0000001;

            if (1.0 - abs(NdotUp) <= epsilon) {
                // Sampling +Y or -Y, so we need a more robust bitangent.
                if (NdotUp > 0.0) {
                    bitangent = vec3(0.0, 0.0, 1.0);
                } else {
                    bitangent = vec3(0.0, 0.0, -1.0);
                }
            }

            vec3 tangent = normalize(cross(bitangent, normal));
            bitangent    = cross(normal, tangent);

            return mat3(tangent, bitangent, normal);
        }

        float F_Schlick(float f0, float f90, float VdotH) {
            float x = clamp(1.0 - VdotH, 0.0, 1.0);
            float x2 = x * x;
            float x5 = x * x2 * x2;
            return f0 + (f90 - f0) * x5;
        }

        vec3 F_Schlick_3(vec3 f0, vec3 f90, float VdotH) {
            return f0 + (f90 - f0) * pow(clamp(1.0 - VdotH, 0.0, 1.0), 5.0);
        }

        vec3 F_Schlick_3f(vec3 f0, float f90, float VdotH) {
            float x = clamp(1.0 - VdotH, 0.0, 1.0);
            float x2 = x * x;
            float x5 = x * x2 * x2;
            return f0 + (f90 - f0) * x5;
        }
        
        float Schlick_to_F0(float f, float f90, float VdotH) {
            float x = clamp(1.0 - VdotH, 0.0, 1.0);
            float x2 = x * x;
            float x5 = clamp(x * x2 * x2, 0.0, 0.9999);
        
            return (f - f90 * x5) / (1.0 - x5);
        }

        vec3 Schlick_to_F0_3(vec3 f, vec3 f90, float VdotH) {
            float x = clamp(1.0 - VdotH, 0.0, 1.0);
            float x2 = x * x;
            float x5 = clamp(x * x2 * x2, 0.0, 0.9999);
        
            return (f - f90 * x5) / (1.0 - x5);
        }

        float D_GGX(float NdotH, float roughness) {
            float a = NdotH * roughness;
            float k = roughness / (1.0 - NdotH * NdotH + a * a);
            return k * k * (1.0 / ${M_PI});
        }

        // NDF
        float D_Ashikhmin(float NdotH, float roughness) {
            float alpha = roughness * roughness;
            // Ashikhmin 2007, "Distribution-based BRDFs"
            float a2 = alpha * alpha;
            float cos2h = NdotH * NdotH;
            float sin2h = 1.0 - cos2h;
            float sin4h = sin2h * sin2h;
            float cot2 = -cos2h / (a2 * sin2h);
            return 1.0 / (${M_PI} * (4.0 * a2 + 1.0) * sin4h) * (4.0 * exp(cot2) + sin4h);
        }

        // NDF
        float D_Charlie(float sheenRoughness, float NdotH) {
            float roughness = max(sheenRoughness, 0.000001); //clamp (0,1]
            float invR = 1.0 / roughness;
            float cos2h = NdotH * NdotH;
            float sin2h = 1.0 - cos2h;
            return (2.0 + invR) * pow(sin2h, invR * 0.5) / (2.0 * ${M_PI});
        }

        // From the filament docs. Geometric Shadowing function
        // https://google.github.io/filament/Filament.html#toc4.4.2
        float V_SmithGGXCorrelated(float NoV, float NoL, float roughness) {
            float a2 = pow(roughness, 4.0);
            float GGXV = NoL * sqrt(NoV * NoV * (1.0 - a2) + a2);
            float GGXL = NoV * sqrt(NoL * NoL * (1.0 - a2) + a2);
            return 0.5 / (GGXV + GGXL);
        }

        // https://github.com/google/filament/blob/master/shaders/src/brdf.fs#L136
        float V_Ashikhmin(float NdotL, float NdotV) {
            return clamp(1.0 / (4.0 * (NdotL + NdotV - NdotL * NdotV)), 0.0, 1.0);
        }

        float V_GGX(float NdotL, float NdotV, float alphaRoughness) {
            float alphaRoughnessSq = alphaRoughness * alphaRoughness;

            float GGXV = NdotL * sqrt(NdotV * NdotV * (1.0 - alphaRoughnessSq) + alphaRoughnessSq);
            float GGXL = NdotV * sqrt(NdotL * NdotL * (1.0 - alphaRoughnessSq) + alphaRoughnessSq);

            float GGX = GGXV + GGXL;
            if (GGX > 0.0) {
                return 0.5 / GGX;
            }
            return 0.0;
        }

        float lambdaSheenNumericHelper(float x, float alphaG) {
            float oneMinusAlphaSq = (1.0 - alphaG) * (1.0 - alphaG);
            float a = mix(21.5473, 25.3245, oneMinusAlphaSq);
            float b = mix(3.82987, 3.32435, oneMinusAlphaSq);
            float c = mix(0.19823, 0.16801, oneMinusAlphaSq);
            float d = mix(-1.97760, -1.27393, oneMinusAlphaSq);
            float e = mix(-4.32054, -4.85967, oneMinusAlphaSq);
            return a / (1.0 + b * pow(x, c)) + d * x + e;
        }

        float lambdaSheen(float cosTheta, float alphaG) {
            if (abs(cosTheta) < 0.5) {
                return exp(lambdaSheenNumericHelper(cosTheta, alphaG));
            }

            return exp(2.0 * lambdaSheenNumericHelper(0.5, alphaG) - lambdaSheenNumericHelper(1.0 - cosTheta, alphaG));
        }


        float V_Sheen(float NdotL, float NdotV, float sheenRoughness) {
            float roughness = max(sheenRoughness, 0.000001); //clamp (0,1]
            float alphaG = roughness * roughness;

            return clamp(1.0 / ((1.0 + lambdaSheen(NdotV, alphaG) + lambdaSheen(NdotL, alphaG)) * (4.0 * NdotV * NdotL)), 0.0, 1.0);
        }

        struct MicrofacetDistributionSample {
            float pdf;
            float cosTheta;
            float sinTheta;
            float phi;
        };

        // GGX microfacet distribution
        // https://www.cs.cornell.edu/~srm/publications/EGSR07-btdf.html
        // This implementation is based on https://bruop.github.io/ibl/,
        //  https://www.tobias-franke.eu/log/2014/03/30/notes_on_importance_sampling.html
        // and https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_ch20.html
        MicrofacetDistributionSample GGX(vec2 xi, float roughness) {
            MicrofacetDistributionSample ggx;

            // evaluate sampling equations
            float alpha = roughness * roughness;
            ggx.cosTheta = saturate(sqrt((1.0 - xi.y) / (1.0 + (alpha * alpha - 1.0) * xi.y)));
            ggx.sinTheta = sqrt(1.0 - ggx.cosTheta * ggx.cosTheta);
            ggx.phi = 2.0 * ${M_PI} * xi.x;

            // evaluate GGX pdf (for half vector)
            ggx.pdf = D_GGX(ggx.cosTheta, alpha);

            // Apply the Jacobian to obtain a pdf that is parameterized by l
            // see https://bruop.github.io/ibl/
            // Typically you'd have the following:
            // float pdf = D_GGX(NoH, roughness) * NoH / (4.0 * VoH);
            // but since V = N => VoH == NoH
            ggx.pdf = ggx.pdf /4.0;

            return ggx;
        }

        MicrofacetDistributionSample Charlie(vec2 xi, float roughness) {
            MicrofacetDistributionSample charlie;

            float alpha = roughness * roughness;
            charlie.sinTheta = pow(xi.y, alpha / (2.0*alpha + 1.0));
            charlie.cosTheta = sqrt(1.0 - charlie.sinTheta * charlie.sinTheta);
            charlie.phi = 2.0 * ${M_PI} * xi.x;

            // evaluate Charlie pdf (for half vector)
            charlie.pdf = D_Charlie(alpha, charlie.cosTheta);

            // Apply the Jacobian to obtain a pdf that is parameterized by l
            charlie.pdf = charlie.pdf / 4.0;

            return charlie;
        }


        vec3 BRDF_lambertian(vec3 f0, vec3 f90, vec3 diffuseColor, float specularWeight, float VdotH) {
            return (1.0 - specularWeight * F_Schlick_3(f0, f90, VdotH)) * (diffuseColor / ${M_PI});
        }

        //https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#acknowledgments AppendixB
        vec3 BRDF_lambertianIridescence(vec3 f0, vec3 f90, vec3 diffuseColor, float specularWeight, float VdotH, vec3 iridescenceFresnel, float iridescenceFactor) {
            // Use the maximum component of the iridescence Fresnel color
            // Maximum is used instead of the RGB value to not get inverse colors for the diffuse BRDF
            vec3 iridescenceFresnelMax = vec3(max(max(iridescenceFresnel.r, iridescenceFresnel.g), iridescenceFresnel.b));

            vec3 schlickFresnel = F_Schlick_3(f0, f90, VdotH);

            // Blend default specular Fresnel with iridescence Fresnel
            vec3 F = mix(schlickFresnel, iridescenceFresnelMax, iridescenceFactor);

            // see https://seblagarde.wordpress.com/2012/01/08/pi-or-not-to-pi-in-game-lighting-equation/
            return (1.0 - specularWeight * F) * (diffuseColor / ${M_PI});
        }

        vec3 BRDF_specularGGX(vec3 f0, vec3 f90, float alphaRoughness, float specularWeight, float VdotH, float NdotL, float NdotV, float NdotH) {
            vec3 F = F_Schlick_3(f0, f90, VdotH);
            float Vis = V_GGX(NdotL, NdotV, alphaRoughness);
            float D = D_GGX(NdotH, alphaRoughness);

            return specularWeight * F * Vis * D;
        }

        vec3 BRDF_specularGGXIridescence(vec3 f0, vec3 f90, float alphaRoughness, float specularWeight, float VdotH, float NdotL, float NdotV, float NdotH, vec3 iridescenceFresnel, float iridescenceFactor) {
            vec3 F = mix(F_Schlick_3(f0, f90, VdotH), iridescenceFresnel, iridescenceFactor);
            float Vis = V_GGX(NdotL, NdotV, alphaRoughness);
            float D = D_GGX(NdotH, alphaRoughness);

            return specularWeight * F * Vis * D;
        }

        vec3 BRDF_specularSheen(vec3 sheenColor, float sheenRoughness, float NdotL, float NdotV, float NdotH) {
            float sheenDistribution = D_Charlie(sheenRoughness, NdotH);
            float sheenVisibility = V_Sheen(NdotL, NdotV, sheenRoughness);
            return sheenColor * sheenDistribution * sheenVisibility;
        }

        vec4 getImportanceSample(int i, vec3 N, float roughness, int distribution, int sampleCount) {
            // generate a quasi monte carlo point in the unit square [0.1)^2
            vec2 xi = hammersley2d(i, sampleCount);

            MicrofacetDistributionSample importanceSample;

            // generate the points on the hemisphere with a fitting mapping for
            // the distribution
            if(distribution == ${GGX}) {
                // Trowbridge-Reitz / GGX microfacet model (Walter et al)
                // https://www.cs.cornell.edu/~srm/publications/EGSR07-btdf.html
                importanceSample = GGX(xi, roughness);
            } else if(distribution == ${CHARLIE}) {
                importanceSample = Charlie(xi, roughness);
            }

            // transform the hemisphere sample to the normal coordinate frame
            // i.e. rotate the hemisphere to the normal direction
            vec3 localSpaceDirection = normalize(vec3(
                importanceSample.sinTheta * cos(importanceSample.phi), 
                importanceSample.sinTheta * sin(importanceSample.phi), 
                importanceSample.cosTheta
            ));
            mat3 TBN = generateTBN(N);
            vec3 direction = TBN * localSpaceDirection;

            return vec4(direction, importanceSample.pdf);
        }

        // sRGB => XYZ => D65_2_D60 => AP1 => RRT_SAT
        const mat3 ACESInputMat = mat3
        (
            0.59719, 0.07600, 0.02840,
            0.35458, 0.90834, 0.13383,
            0.04823, 0.01566, 0.83777
        );


        // ODT_SAT => XYZ => D60_2_D65 => sRGB
        const mat3 ACESOutputMat = mat3
        (
            1.60475, -0.10208, -0.00327,
            -0.53108,  1.10813, -0.07276,
            -0.07367, -0.00605,  1.07602
        );

        // ACES tone map (faster approximation)
        // see: https://knarkowicz.wordpress.com/2016/01/06/aces-filmic-tone-mapping-curve/
        vec3 toneMapACES_Narkowicz(vec3 color) {
            const float A = 2.51;
            const float B = 0.03;
            const float C = 2.43;
            const float D = 0.59;
            const float E = 0.14;
            return clamp((color * (A * color + B)) / (color * (C * color + D) + E), vec3(0.0), vec3(1.0));
        }

        // ACES filmic tone map approximation
        // see https://github.com/TheRealMJP/BakingLab/blob/master/BakingLab/ACES.hlsl
        vec3 RRTAndODTFit(vec3 color) {
            vec3 a = color * (color + 0.0245786) - 0.000090537;
            vec3 b = color * (0.983729 * color + 0.4329510) + 0.238081;
            return a / b;
        }

        // tone mapping 
        vec3 toneMapACES_Hill(vec3 color) {
            vec3 c = ACESInputMat * color;

            // Apply RRT and ODT
            c = RRTAndODTFit(c);

            c = ACESOutputMat * c;

            // Clamp to [0, 1]
            c = clamp(c, vec3(0.0), vec3(1.0));

            return c;
        }

        float sq(float t) {
            return t * t;
        }

        vec2 sq2(vec2 t) {
            return t * t;
        }

        vec3 sq3(vec3 t) {
            return t * t;
        }

        vec4 sq4(vec4 t) {
            return t * t;
        }

        // XYZ to sRGB color space
        const mat3 XYZ_TO_REC709 = mat3(
            3.2404542, -0.9692660,  0.0556434,
            -1.5371385,  1.8760108, -0.2040259,
            -0.4985314,  0.0415560,  1.0572252
        );

        // Assume air interface for top
        // Note: We don't handle the case fresnel0 == 1
        vec3 Fresnel0ToIor(vec3 fresnel0) {
            vec3 sqrtF0 = sqrt(fresnel0);
            return (vec3(1.0) + sqrtF0) / (vec3(1.0) - sqrtF0);
        }

        // ior is a value between 1.0 and 3.0. 1.0 is air interface
        float IorToFresnel0(float transmittedIor, float incidentIor) {
            return sq((transmittedIor - incidentIor) / (transmittedIor + incidentIor));
        }

        // Conversion FO/IOR
        vec3 IorToFresnel0_3(vec3 transmittedIor, float incidentIor) {
            return sq3((transmittedIor - vec3(incidentIor)) / (transmittedIor + vec3(incidentIor)));
        }

        // Fresnel equations for dielectric/dielectric interfaces.
        // Ref: https://belcour.github.io/blog/publication/research/2017/05/01/brdf-thin-film.html
        // Evaluation XYZ sensitivity curves in Fourier space
        vec3 evalSensitivity(float OPD, vec3 shift) {
            float phase = 2.0 * ${M_PI} * OPD * 1.0e-9;
            vec3 val = vec3(5.4856e-13, 4.4201e-13, 5.2481e-13);
            vec3 pos = vec3(1.6810e+06, 1.7953e+06, 2.2084e+06);
            vec3 vaR = vec3(4.3278e+09, 9.3046e+09, 6.6121e+09);

            vec3 xyz = val * sqrt(2.0 * ${M_PI} * vaR) * cos(pos * phase + shift) * exp(-sq(phase) * vaR);
            xyz.x = xyz.x + 9.7470e-14 * sqrt(2.0 * ${M_PI} * 4.5282e+09) * cos(2.2399e+06 * phase + shift[0]) * exp(-4.5282e+09 * sq(phase));
            xyz = xyz / 1.0685e-7;

            vec3 srgb = XYZ_TO_REC709 * xyz;
            return srgb;
        }

        vec3 evalIridescence(float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0) {
            vec3 I;

            // Force iridescenceIor -> outsideIOR when thinFilmThickness -> 0.0
            float iridescenceIor = mix(outsideIOR, eta2, smoothstep(0.0, 0.03, thinFilmThickness));
            // Evaluate the cosTheta on the base layer (Snell law)
            float sinTheta2Sq = sq(outsideIOR / iridescenceIor) * (1.0 - sq(cosTheta1));

            // Handle TIR:
            float cosTheta2Sq = 1.0 - sinTheta2Sq;
            if (cosTheta2Sq < 0.0) {
                return vec3(1.0);
            }

            float cosTheta2 = sqrt(cosTheta2Sq);

            // First interface
            float R0 = IorToFresnel0(iridescenceIor, outsideIOR);
            float R12 = F_Schlick(R0, 1.0, cosTheta1);
            float R21 = R12;
            float T121 = 1.0 - R12;
            float phi12 = 0.0;
            if (iridescenceIor < outsideIOR) { phi12 = ${M_PI}; }
            float phi21 = ${M_PI} - phi12;

            // Second interface
            vec3 baseIOR = Fresnel0ToIor(clamp(baseF0, vec3(0.0), vec3(0.9999))); // guard against 1.0
            vec3 R1 = IorToFresnel0_3(baseIOR, iridescenceIor);
            vec3 R23 = F_Schlick_3f(R1, 1.0, cosTheta2);
            vec3 phi23 = vec3(0.0);
            if (baseIOR[0] < iridescenceIor) { phi23[0] = ${M_PI}; }
            if (baseIOR[1] < iridescenceIor) { phi23[1] = ${M_PI}; }
            if (baseIOR[2] < iridescenceIor) { phi23[2] = ${M_PI}; }

            // Phase shift
            float OPD = 2.0 * iridescenceIor * thinFilmThickness * cosTheta2;
            vec3 phi = vec3(phi21) + phi23;

            // Compound terms
            vec3 R123 = clamp(R12 * R23, vec3(1e-5), vec3(0.9999));
            vec3 r123 = sqrt(R123);
            vec3 Rs = sq(T121) * R23 / (vec3(1.0) - R123);

            // Reflectance term for m = 0 (DC term amplitude)
            vec3 C0 = R12 + Rs;
            I = C0;

            // Reflectance term for m > 0 (pairs of diracs)
            vec3 Cm = Rs - T121;
            for (int m = 1; m <= 2; m += 1)
            {
                Cm = Cm * r123;
                vec3 Sm = 2.0 * evalSensitivity(float(m) * OPD, float(m) * phi);
                I = I + (Cm * Sm);
            }

            // Since out of gamut colors might be produced, negative color values are clamped to 0.
            return max(I, vec3(0.0));
        }
    `;

    return code;
}

export default generate;