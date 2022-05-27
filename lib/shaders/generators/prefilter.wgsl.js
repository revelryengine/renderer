import fullscreenVert        from './fullscreen.vert.wgsl.js';
import generateFormulasBlock from './formulas.wgsl.js';
import generateUniformBlock  from './uniform.wgsl.js';

const formulasBlock = generateFormulasBlock();

const M_PI    = '3.141592653589793';
const GGX     = 0;
const CHARLIE = 1;

export function generate({ input: { prefilter } }) {
    const vertex = fullscreenVert();

    const fragment = /* wgsl */`

        ${generateUniformBlock(prefilter, 0, 0)}

        @group(0) @binding(1) var colorSampler: sampler;
        @group(0) @binding(2) var colorTexture: texture_cube<f32>;
        
        struct VertexOutput {
            @builtin(position) position: vec4<f32>;
            @location(0) texCoord: vec2<f32>;
            @location(1) @interpolate(flat) texLayer: i32;
        };

        struct FragmentOutput {
            @location(0) color: vec4<f32>;
        };

        fn cubeCoord(uv: vec2<f32>, face: i32) -> vec3<f32> {
            if(face == 0) {
                return normalize(vec3<f32>(  1.0, -uv.y,-uv.x));
            } else if(face == 1) {
                return normalize(vec3<f32>( -1.0, -uv.y, uv.x));
            } else if(face == 2) {
                return normalize(vec3<f32>( uv.x, 1.0, uv.y));
            } else if(face == 3) {
                return normalize(vec3<f32>( uv.x, -1.0,-uv.y));
            } else if(face == 4) {
                return normalize(vec3<f32>( uv.x, -uv.y,  1.0));
            } else if(face == 5) {
                return normalize(vec3<f32>(-uv.x, -uv.y, -1.0));
            }
            return vec3<f32>(0.0);
        }

        ${formulasBlock}

        // Mipmap Filtered Samples (GPU Gems 3, 20.4)
        // https://developer.nvidia.com/gpugems/gpugems3/part-iii-rendering/chapter-20-gpu-based-importance-sampling
        // https://cgg.mff.cuni.cz/~jaroslav/papers/2007-sketch-fis/Final_sap_0073.pdf
        fn computeLod(pdf: f32) -> f32{
            var size = f32(textureDimensions(colorTexture, 0).x);
            // https://cgg.mff.cuni.cz/~jaroslav/papers/2007-sketch-fis/Final_sap_0073.pdf
            return 0.5 * log2( 6.0 * size * size / (f32(prefilter.sampleCount) * pdf));
        }

        fn filterColor(N: vec3<f32>) -> vec3<f32> {
            var color  = vec3<f32>(0.0);
            var weight = 0.0;

            for(var i = 0; i < prefilter.sampleCount; i = i + 1) {
                var importanceSample = getImportanceSample(i, N, prefilter.roughness, prefilter.distribution, prefilter.sampleCount);

                var H   = vec3<f32>(importanceSample.xyz);
                var pdf = importanceSample.w;

                // mipmap filtered samples (GPU Gems 3, 20.4)
                var lod = computeLod(pdf);

                // apply the bias to the lod
                lod = lod + prefilter.lodBias;

                // Note: reflect takes incident vector.
                var V = N;
                var L = normalize(reflect(-V, H));
                var NdotL = dot(N, L);

                if (NdotL > 0.0) {
                    if(prefilter.roughness == 0.0) {
                        // without this the roughness=0 lod is too high
                        lod = prefilter.lodBias;
                    }

                    var sampleColor = textureSampleLevel(colorTexture, colorSampler, L, lod).rgb;
                    color  = color + sampleColor * NdotL;
                    weight = weight + NdotL;                    
                }
            }

            if(weight != 0.0) {
                color = color / weight;
            } else {
                color = color / f32(prefilter.sampleCount);
            }

            return color.rgb;
        }

        @stage(fragment)
        fn main(in: VertexOutput) -> FragmentOutput {
            var out: FragmentOutput;
            out.color = vec4<f32>(filterColor(cubeCoord(in.texCoord * 2.0 - 1.0, in.texLayer)), 1.0);
            return out;
        }        
    `;
    
    return { vertex, fragment };
}

export function generateLUT({ input: { prefilter } }) {
    const vertex = fullscreenVert();

    const fragment = /* wgsl */`
        ${generateUniformBlock(prefilter, 0, 0)}

        struct VertexOutput {
            @builtin(position) position: vec4<f32>;
            @location(0) texCoord: vec2<f32>;
            @location(1) @interpolate(flat) texLayer: i32;
        };

        struct FragmentOutput {
            @location(0) color: vec4<f32>;
        };

        ${formulasBlock}

        // Compute LUT for GGX/Charlie distributions.
        // See https://blog.selfshadow.com/publications/s2013-shading-course/karis/s2013_pbs_epic_notes_v2.pdf
        fn LUT(NdotV: f32, roughness: f32) -> vec3<f32>{
            // Compute spherical view vector: (sin(phi), 0, cos(phi))
            var V = vec3<f32>(sqrt(1.0 - NdotV * NdotV), 0.0, NdotV);

            // The macro surface normal just points up.
            var N = vec3<f32>(0.0, 0.0, 1.0);

            // To make the LUT independant from the material's F0, which is part of the Fresnel term
            // when substituted by Schlick's approximation, we factor it out of the integral,
            // yielding to the form: F0 * I1 + I2
            // I1 and I2 are slighlty different in the Fresnel term, but both only depend on
            // NoL and roughness, so they are both numerically integrated and written into two channels.
            var A = 0.0;
            var B = 0.0;
            var C = 0.0;

            for(var i = 0; i < prefilter.sampleCount; i = i + 1) {
                // LUT for GGX distribution.
                var importanceSample = getImportanceSample(i, N, roughness, ${GGX}, prefilter.sampleCount);

                var H = importanceSample.xyz;
                var L = normalize(reflect(-V, H));

                var NdotL = saturate(L.z);
                var NdotH = saturate(H.z);
                var VdotH = saturate(dot(V, H));
                if (NdotL > 0.0) {
                    // Taken from: https://bruop.github.io/ibl
                    // Shadertoy: https://www.shadertoy.com/view/3lXXDB
                    // Terms besides V are from the GGX PDF we're dividing by.
                    var V_pdf = V_SmithGGXCorrelated(NdotV, NdotL, roughness) * VdotH * NdotL / NdotH;
                    var Fc = pow(1.0 - VdotH, 5.0);
                    A = A + (1.0 - Fc) * V_pdf;
                    B = B + Fc * V_pdf;
                }

                // LUT for Charlie distribution.
                importanceSample = getImportanceSample(i, N, roughness, ${CHARLIE}, prefilter.sampleCount);

                H = importanceSample.xyz;
                L = normalize(reflect(-V, H));

                NdotL = saturate(L.z);
                NdotH = saturate(H.z);
                VdotH = saturate(dot(V, H));
                if (NdotL > 0.0) {
                    var sheenDistribution = D_Charlie(roughness, NdotH);
                    var sheenVisibility = V_Ashikhmin(NdotL, NdotV);

                    C = C + sheenVisibility * sheenDistribution * NdotL * VdotH;
                }
            }

            // The PDF is simply pdf(v, h) -> NDF * <nh>.
            // To parametrize the PDF over l, use the Jacobian transform, yielding to: pdf(v, l) -> NDF * <nh> / 4<vh>
            // Since the BRDF divide through the PDF to be normalized, the 4 can be pulled out of the integral.
            return vec3<f32>(4.0 * A, 4.0 * B, 4.0 * 2.0 * ${M_PI} * C) / f32(prefilter.sampleCount);
        }

        @stage(fragment)
        fn main(in: VertexOutput) -> FragmentOutput {
            var out: FragmentOutput;
            out.color = vec4<f32>(LUT(in.texCoord.x, in.texCoord.y), 1.0);
            return out;
        }   
    `;

    return { vertex, fragment };
}

export default generate;