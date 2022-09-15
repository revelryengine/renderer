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

        fn F_Schlick(f0: f32, f90: f32, VdotH: f32) -> f32 {
            var x = clamp(1.0 - VdotH, 0.0, 1.0);
            var x2 = x * x;
            var x5 = x * x2 * x2;
            return f0 + (f90 - f0) * x5;
        }

        fn F_Schlick_3(f0: vec3<f32>, f90: vec3<f32>, VdotH: f32) -> vec3<f32> {
            return f0 + (f90 - f0) * pow(clamp(1.0 - VdotH, 0.0, 1.0), 5.0);
        }

        fn F_Schlick_3f(f0: vec3<f32>, f90: f32, VdotH: f32) -> vec3<f32> {
            var x = clamp(1.0 - VdotH, 0.0, 1.0);
            var x2 = x * x;
            var x5 = x * x2 * x2;
            return f0 + (f90 - f0) * x5;
        }

        
        
        fn Schlick_to_F0(f: f32, f90: f32, VdotH: f32) -> f32 {
            var x = clamp(1.0 - VdotH, 0.0, 1.0);
            var x2 = x * x;
            var x5 = clamp(x * x2 * x2, 0.0, 0.9999);
        
            return (f - f90 * x5) / (1.0 - x5);
        }

        fn Schlick_to_F0_3(f: vec3<f32>, f90: vec3<f32>, VdotH: f32) -> vec3<f32> {
            var x = clamp(1.0 - VdotH, 0.0, 1.0);
            var x2 = x * x;
            var x5 = clamp(x * x2 * x2, 0.0, 0.9999);
        
            return (f - f90 * x5) / (1.0 - x5);
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
            return (1.0 - specularWeight * F_Schlick_3(f0, f90, VdotH)) * (diffuseColor / ${M_PI});
        }

        //https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#acknowledgments AppendixB
        fn BRDF_lambertianIridescence(f0: vec3<f32>, f90: vec3<f32>, diffuseColor: vec3<f32>, specularWeight: f32, VdotH: f32, iridescenceFresnel: vec3<f32>, iridescenceFactor: f32) -> vec3<f32> {
            // Use the maximum component of the iridescence Fresnel color
            // Maximum is used instead of the RGB value to not get inverse colors for the diffuse BRDF
            var iridescenceFresnelMax = vec3<f32>(max(max(iridescenceFresnel.r, iridescenceFresnel.g), iridescenceFresnel.b));

            var schlickFresnel = F_Schlick_3(f0, f90, VdotH);

            // Blend default specular Fresnel with iridescence Fresnel
            var F = mix(schlickFresnel, iridescenceFresnelMax, iridescenceFactor);

            // see https://seblagarde.wordpress.com/2012/01/08/pi-or-not-to-pi-in-game-lighting-equation/
            return (1.0 - specularWeight * F) * (diffuseColor / ${M_PI});
        }

        fn BRDF_specularGGX(f0: vec3<f32>, f90: vec3<f32>, alphaRoughness: f32, specularWeight: f32, VdotH: f32, NdotL: f32, NdotV: f32, NdotH: f32) -> vec3<f32> {
            var F   = F_Schlick_3(f0, f90, VdotH);
            var Vis = V_GGX(NdotL, NdotV, alphaRoughness);
            var D   = D_GGX(NdotH, alphaRoughness);

            return specularWeight * F * Vis * D;
        }

        fn BRDF_specularGGXIridescence(f0: vec3<f32>, f90: vec3<f32>, alphaRoughness: f32, specularWeight: f32, VdotH: f32, NdotL: f32, NdotV: f32, NdotH: f32, iridescenceFresnel: vec3<f32>, iridescenceFactor: f32) -> vec3<f32> {
            var F = mix(F_Schlick_3(f0, f90, VdotH), iridescenceFresnel, iridescenceFactor);
            var Vis = V_GGX(NdotL, NdotV, alphaRoughness);
            var D = D_GGX(NdotH, alphaRoughness);

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
        const ACESInputMat = mat3x3<f32>
        (
            0.59719, 0.07600, 0.02840,
            0.35458, 0.90834, 0.13383,
            0.04823, 0.01566, 0.83777
        );


        // ODT_SAT => XYZ => D60_2_D65 => sRGB
        const ACESOutputMat = mat3x3<f32>
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

        fn sq(t: f32) -> f32 {
            return t * t;
        }

        fn sq2(t: vec2<f32>) -> vec2<f32>{
            return t * t;
        }

        fn sq3(t: vec3<f32>) -> vec3<f32> {
            return t * t;
        }

        fn sq4(t: vec4<f32>) -> vec4<f32> {
            return t * t;
        }

        // XYZ to sRGB color space
        const XYZ_TO_REC709 = mat3x3<f32>(
            vec3<f32>(3.2404542, -0.9692660,  0.0556434),
            vec3<f32>(-1.5371385,  1.8760108, -0.2040259),
            vec3<f32>(-0.4985314,  0.0415560,  1.0572252)
        );

        // Assume air interface for top
        // Note: We don't handle the case fresnel0 == 1
        fn Fresnel0ToIor(fresnel0: vec3<f32>) -> vec3<f32>{
            var sqrtF0 = sqrt(fresnel0);
            return (vec3<f32>(1.0) + sqrtF0) / (vec3<f32>(1.0) - sqrtF0);
        }

        // ior is a value between 1.0 and 3.0. 1.0 is air interface
        fn IorToFresnel0(transmittedIor: f32, incidentIor: f32) -> f32{
            return sq((transmittedIor - incidentIor) / (transmittedIor + incidentIor));
        }

        // Conversion FO/IOR
        fn IorToFresnel0_3(transmittedIor: vec3<f32>, incidentIor: f32) -> vec3<f32> {
            return sq3((transmittedIor - vec3<f32>(incidentIor)) / (transmittedIor + vec3<f32>(incidentIor)));
        }

        // Fresnel equations for dielectric/dielectric interfaces.
        // Ref: https://belcour.github.io/blog/research/2017/05/01/brdf-thin-film.html
        // Evaluation XYZ sensitivity curves in Fourier space
        fn evalSensitivity(OPD: f32, shift: vec3<f32>) -> vec3<f32> {
            var phase = 2.0 * ${M_PI} * OPD * 1.0e-9;
            var val = vec3<f32>(5.4856e-13, 4.4201e-13, 5.2481e-13);
            var pos = vec3<f32>(1.6810e+06, 1.7953e+06, 2.2084e+06);
            var vaR = vec3<f32>(4.3278e+09, 9.3046e+09, 6.6121e+09);

            var xyz = val * sqrt(2.0 * ${M_PI} * vaR) * cos(pos * phase + shift) * exp(-sq(phase) * vaR);
            xyz.x = xyz.x + 9.7470e-14 * sqrt(2.0 * ${M_PI} * 4.5282e+09) * cos(2.2399e+06 * phase + shift[0]) * exp(-4.5282e+09 * sq(phase));
            xyz = xyz / 1.0685e-7;

            var srgb = XYZ_TO_REC709 * xyz;
            return srgb;
        }

        fn evalIridescence(outsideIOR: f32, eta2: f32, cosTheta1: f32, thinFilmThickness: f32, baseF0: vec3<f32>) -> vec3<f32> {
            var I: vec3<f32>;

            // Force iridescenceIor -> outsideIOR when thinFilmThickness -> 0.0
            var iridescenceIor = mix(outsideIOR, eta2, smoothstep(0.0, 0.03, thinFilmThickness));
            // Evaluate the cosTheta on the base layer (Snell law)
            var sinTheta2Sq = sq(outsideIOR / iridescenceIor) * (1.0 - sq(cosTheta1));

            // Handle TIR:
            var cosTheta2Sq = 1.0 - sinTheta2Sq;
            if (cosTheta2Sq < 0.0) {
                return vec3<f32>(1.0);
            }

            var cosTheta2 = sqrt(cosTheta2Sq);

            // First interface
            var R0 = IorToFresnel0(iridescenceIor, outsideIOR);
            var R12 = F_Schlick(R0, 1.0, cosTheta1);
            var R21 = R12;
            var T121 = 1.0 - R12;
            var phi12 = 0.0;
            if (iridescenceIor < outsideIOR) { phi12 = ${M_PI}; }
            var phi21 = ${M_PI} - phi12;

            // Second interface
            var baseIOR = Fresnel0ToIor(clamp(baseF0, vec3<f32>(0.0), vec3<f32>(0.9999))); // guard against 1.0
            var R1 = IorToFresnel0_3(baseIOR, iridescenceIor);
            var R23 = F_Schlick_3f(R1, 1.0, cosTheta2);
            var phi23 = vec3<f32>(0.0);
            if (baseIOR[0] < iridescenceIor) { phi23[0] = ${M_PI}; }
            if (baseIOR[1] < iridescenceIor) { phi23[1] = ${M_PI}; }
            if (baseIOR[2] < iridescenceIor) { phi23[2] = ${M_PI}; }

            // Phase shift
            var OPD = 2.0 * iridescenceIor * thinFilmThickness * cosTheta2;
            var phi = vec3<f32>(phi21) + phi23;

            // Compound terms
            var R123 = clamp(R12 * R23, vec3<f32>(1e-5), vec3<f32>(0.9999));
            var r123 = sqrt(R123);
            var Rs = sq(T121) * R23 / (vec3<f32>(1.0) - R123);

            // Reflectance term for m = 0 (DC term amplitude)
            var C0 = R12 + Rs;
            I = C0;

            // Reflectance term for m > 0 (pairs of diracs)
            var Cm = Rs - T121;
            for (var m = 1; m <= 2; m += 1)
            {
                Cm = Cm * r123;
                var Sm = 2.0 * evalSensitivity(f32(m) * OPD, f32(m) * phi);
                I = I + (Cm * Sm);
            }

            // Since out of gamut colors might be produced, negative color values are clamped to 0.
            return max(I, vec3<f32>(0.0));
        }
    `;

    return code;
}

export default generate;