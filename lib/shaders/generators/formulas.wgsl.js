/**
 * 
 */
const M_PI    = '3.141592653589793';
const GGX     = 0;
const CHARLIE = 1;

export function generate() {
    const code = /* wgsl */`
        fn saturate(v: f32) -> f32 {
            return clamp(v, 0.0, 1.0);
        }

        fn clampedDot(x: vec3<f32>, y: vec3<f32>) -> f32 {
            return clamp(dot(x, y), 0.0, 1.0);
        }

        fn linearTosRGB(color: vec3<f32>) -> vec3<f32> {
            return pow(color, vec3<f32>(1.0 / 2.2));
        }

        fn max3(v: vec3<f32>) -> f32 {
            return max(max(v.x, v.y), v.z);
        }

        // Hammersley Points on the Hemisphere
        // CC BY 3.0 (Holger Dammertz)
        // http://holger.dammertz.org/stuff/notes_HammersleyOnHemisphere.html
        // with adapted interface
        fn radicalInverse_VdC(i: u32) -> f32 {
            var bits = i;
            bits = (bits << 16u) | (bits >> 16u);
            bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
            bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
            bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
            bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
            return f32(bits) * 2.3283064365386963e-10; // / 0x100000000
        }

        // hammersley2d describes a sequence of points in the 2d unit square [0,1)^2
        // that can be used for quasi Monte Carlo integration
        fn hammersley2d(i: i32, N: i32) -> vec2<f32> {
            return vec2<f32>(f32(i)/f32(N), radicalInverse_VdC(u32(i)));
        }

        // Hemisphere Sample

        // TBN generates a tangent bitangent normal coordinate frame from the normal
        // (the normal must be normalized)
        fn generateTBN(normal: vec3<f32>) -> mat3x3<f32> {
            var bitangent = vec3<f32>(0.0, 1.0, 0.0);

            var NdotUp  = dot(normal, vec3<f32>(0.0, 1.0, 0.0));
            var epsilon = 0.0000001;

            if (1.0 - abs(NdotUp) <= epsilon) {
                // Sampling +Y or -Y, so we need a more robust bitangent.
                if (NdotUp > 0.0) {
                    bitangent = vec3<f32>(0.0, 0.0, 1.0);
                } else {
                    bitangent = vec3<f32>(0.0, 0.0, -1.0);
                }
            }

            var tangent = normalize(cross(bitangent, normal));
            bitangent    = cross(normal, tangent);

            return mat3x3<f32>(tangent, bitangent, normal);
        }

        fn F_Schlick(f0: vec3<f32>, f90: vec3<f32>, VdotH: f32) -> vec3<f32> {
            return f0 + (f90 - f0) * pow(clamp(1.0 - VdotH, 0.0, 1.0), 5.0);
        }

        fn D_GGX(NdotH: f32, alphaRoughness: f32) -> f32 {
            var alphaRoughnessSq = alphaRoughness * alphaRoughness;
            var f = (NdotH * NdotH) * (alphaRoughnessSq - 1.0) + 1.0;
            return alphaRoughnessSq / (${M_PI} * f * f);
        }

        // NDF
        fn D_Ashikhmin(NdotH: f32, roughness: f32) -> f32 {
            var alpha = roughness * roughness;
            // Ashikhmin 2007, "Distribution-based BRDFs"
            var a2 = alpha * alpha;
            var cos2h = NdotH * NdotH;
            var sin2h = 1.0 - cos2h;
            var sin4h = sin2h * sin2h;
            var cot2 = -cos2h / (a2 * sin2h);
            return 1.0 / (${M_PI} * (4.0 * a2 + 1.0) * sin4h) * (4.0 * exp(cot2) + sin4h);
        }

        // NDF
        fn D_Charlie(sheenRoughness: f32, NdotH: f32) -> f32 {
            var roughness = max(sheenRoughness, 0.000001); //clamp (0,1]
            var invR = 1.0 / roughness;
            var cos2h = NdotH * NdotH;
            var sin2h = 1.0 - cos2h;
            return (2.0 + invR) * pow(sin2h, invR * 0.5) / (2.0 * ${M_PI});
        }

        // From the filament docs. Geometric Shadowing function
        // https://google.github.io/filament/Filament.html#toc4.4.2
        fn V_SmithGGXCorrelated(NoV: f32, NoL: f32, roughness: f32) -> f32 {
            var a2 = pow(roughness, 4.0);
            var GGXV = NoL * sqrt(NoV * NoV * (1.0 - a2) + a2);
            var GGXL = NoV * sqrt(NoL * NoL * (1.0 - a2) + a2);
            return 0.5 / (GGXV + GGXL);
        }

        // https://github.com/google/filament/blob/master/shaders/src/brdf.fs#L136
        fn V_Ashikhmin(NdotL: f32, NdotV: f32) -> f32 {
            return clamp(1.0 / (4.0 * (NdotL + NdotV - NdotL * NdotV)), 0.0, 1.0);
        }

        fn V_GGX(NdotL: f32, NdotV: f32, alphaRoughness: f32) -> f32 {
            var alphaRoughnessSq = alphaRoughness * alphaRoughness;

            var GGXV = NdotL * sqrt(NdotV * NdotV * (1.0 - alphaRoughnessSq) + alphaRoughnessSq);
            var GGXL = NdotV * sqrt(NdotL * NdotL * (1.0 - alphaRoughnessSq) + alphaRoughnessSq);

            var GGX = GGXV + GGXL;
            if (GGX > 0.0) {
                return 0.5 / GGX;
            }
            return 0.0;
        }

        fn lambdaSheenNumericHelper(x: f32, alphaG: f32) -> f32 {
            var oneMinusAlphaSq = (1.0 - alphaG) * (1.0 - alphaG);
            var a = mix(21.5473, 25.3245, oneMinusAlphaSq);
            var b = mix(3.82987, 3.32435, oneMinusAlphaSq);
            var c = mix(0.19823, 0.16801, oneMinusAlphaSq);
            var d = mix(-1.97760, -1.27393, oneMinusAlphaSq);
            var e = mix(-4.32054, -4.85967, oneMinusAlphaSq);
            return a / (1.0 + b * pow(x, c)) + d * x + e;
        }

        fn lambdaSheen(cosTheta: f32, alphaG: f32) -> f32 {
            if (abs(cosTheta) < 0.5) {
                return exp(lambdaSheenNumericHelper(cosTheta, alphaG));
            } 
            
            return exp(2.0 * lambdaSheenNumericHelper(0.5, alphaG) - lambdaSheenNumericHelper(1.0 - cosTheta, alphaG));
        }

        fn V_Sheen(NdotL: f32, NdotV: f32, sheenRoughness: f32) -> f32 {
            var roughness = max(sheenRoughness, 0.000001); //clamp (0,1]
            var alphaG = roughness * roughness;

            return clamp(1.0 / ((1.0 + lambdaSheen(NdotV, alphaG) + lambdaSheen(NdotL, alphaG)) * (4.0 * NdotV * NdotL)), 0.0, 1.0);
        }

        struct MicrofacetDistributionSample {
            pdf      : f32,
            cosTheta : f32,
            sinTheta : f32,
            phi      : f32,
        };

        // GGX microfacet distribution
        // https://www.cs.cornell.edu/~srm/publications/EGSR07-btdf.html
        // This implementation is based on https://bruop.github.io/ibl/,
        //  https://www.tobias-franke.eu/log/2014/03/30/notes_on_importance_sampling.html
        // and https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_ch20.html
        fn GGX(xi: vec2<f32>, roughness: f32) -> MicrofacetDistributionSample{
            var ggx: MicrofacetDistributionSample;

            // evaluate sampling equations
            var alpha = roughness * roughness;
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
            ggx.pdf = ggx.pdf / 4.0;

            return ggx;
        }

        fn Charlie(xi: vec2<f32>, roughness: f32) -> MicrofacetDistributionSample {
            var charlie: MicrofacetDistributionSample;

            var alpha = roughness * roughness;
            charlie.sinTheta = pow(xi.y, alpha / (2.0*alpha + 1.0));
            charlie.cosTheta = sqrt(1.0 - charlie.sinTheta * charlie.sinTheta);
            charlie.phi = 2.0 * ${M_PI} * xi.x;

            // evaluate Charlie pdf (for half vector)
            charlie.pdf = D_Charlie(alpha, charlie.cosTheta);

            // Apply the Jacobian to obtain a pdf that is parameterized by l
            charlie.pdf = charlie.pdf / 4.0;

            return charlie;
        }
        

        fn BRDF_lambertian(f0: vec3<f32>, f90: vec3<f32>, diffuseColor: vec3<f32>, specularWeight: f32, VdotH: f32) -> vec3<f32> {
            return (1.0 - specularWeight * F_Schlick(f0, f90, VdotH)) * (diffuseColor / ${M_PI});
        }

        fn BRDF_specularGGX(f0: vec3<f32>, f90: vec3<f32>, alphaRoughness: f32, specularWeight: f32, VdotH: f32, NdotL: f32, NdotV: f32, NdotH: f32) -> vec3<f32> {
            var F   = F_Schlick(f0, f90, VdotH);
            var Vis = V_GGX(NdotL, NdotV, alphaRoughness);
            var D   = D_GGX(NdotH, alphaRoughness);

            return specularWeight * F * Vis * D;
        }

        fn BRDF_specularSheen(sheenColor: vec3<f32>, sheenRoughness: f32, NdotL: f32, NdotV: f32, NdotH: f32) -> vec3<f32>{
            var sheenDistribution = D_Charlie(sheenRoughness, NdotH);
            var sheenVisibility = V_Sheen(NdotL, NdotV, sheenRoughness);
            return sheenColor * sheenDistribution * sheenVisibility;
        }

        fn getImportanceSample(i: i32,  N: vec3<f32>, roughness: f32, distribution: i32, sampleCount: i32) -> vec4<f32> {
            // generate a quasi monte carlo point in the unit square [0.1)^2
            var xi = hammersley2d(i, sampleCount);

            var importanceSample: MicrofacetDistributionSample;

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
            var localSpaceDirection = normalize(vec3<f32>(
                importanceSample.sinTheta * cos(importanceSample.phi), 
                importanceSample.sinTheta * sin(importanceSample.phi), 
                importanceSample.cosTheta
            ));
            var TBN = generateTBN(N);
            var direction = TBN * localSpaceDirection;

            return vec4<f32>(direction, importanceSample.pdf);
        }

        // sRGB => XYZ => D65_2_D60 => AP1 => RRT_SAT
        let ACESInputMat = mat3x3<f32>
        (
            0.59719, 0.07600, 0.02840,
            0.35458, 0.90834, 0.13383,
            0.04823, 0.01566, 0.83777
        );


        // ODT_SAT => XYZ => D60_2_D65 => sRGB
        let ACESOutputMat = mat3x3<f32>
        (
            1.60475, -0.10208, -0.00327,
            -0.53108,  1.10813, -0.07276,
            -0.07367, -0.00605,  1.07602
        );

        // ACES tone map (faster approximation)
        // see: https://knarkowicz.wordpress.com/2016/01/06/aces-filmic-tone-mapping-curve/
        fn toneMapACES_Narkowicz(color: vec3<f32> ) -> vec3<f32> {
            let A = 2.51;
            let B = 0.03;
            let C = 2.43;
            let D = 0.59;
            let E = 0.14;
            return clamp((color * (A * color + B)) / (color * (C * color + D) + E), vec3<f32>(0.0), vec3<f32>(1.0));
        }

        // ACES filmic tone map approximation
        // see https://github.com/TheRealMJP/BakingLab/blob/master/BakingLab/ACES.hlsl
        fn RRTAndODTFit(color: vec3<f32>) -> vec3<f32> {
            var a = color * (color + 0.0245786) - 0.000090537;
            var b = color * (0.983729 * color + 0.4329510) + 0.238081;
            return a / b;
        }

        // tone mapping 
        fn toneMapACES_Hill(color: vec3<f32>) -> vec3<f32> {
            var c = ACESInputMat * color;

            // Apply RRT and ODT
            c = RRTAndODTFit(c);

            c = ACESOutputMat * c;

            // Clamp to [0, 1]
            c = clamp(c, vec3<f32>(0.0), vec3<f32>(1.0));

            return c;
        }
    `;

    return code;
}

export default generate;