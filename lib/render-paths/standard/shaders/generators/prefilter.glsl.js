import fullscreenVert from '../../../common/shaders/generators/fullscreen.vert.glsl.js';
import cubecoord      from '../../../common/shaders/generators/cubecoord.glsl.js';

import generateFormulasBlock from './formulas.glsl.js';

const formulasBlock = generateFormulasBlock();

const M_PI    = '3.141592653589793';
const GGX     = 0;
const CHARLIE = 1;

export function generate({ input: { sampleCount, distribution = 0, roughness = 0, lodBias = 0 } }) {
    const vertex = fullscreenVert();

    const fragment = /* glsl */`#version 300 es
        precision highp float;
        precision highp int; //this is needed for mobile devices, otherwise hammersley2d is way off
        
        #pragma revTextureBinding(colorTexture, 0, 1, 0)
        uniform samplerCube colorTexture;

        in vec2 texCoord;
        flat in int texLayer;

        layout(location=0) out vec4 g_finalColor;

        ${cubecoord()}

        ${formulasBlock}

        // Mipmap Filtered Samples (GPU Gems 3, 20.4)
        // https://developer.nvidia.com/gpugems/gpugems3/part-iii-rendering/chapter-20-gpu-based-importance-sampling
        // https://cgg.mff.cuni.cz/~jaroslav/papers/2007-sketch-fis/Final_sap_0073.pdf
        float computeLod(float pdf) {
            float size = float(textureSize(colorTexture, 0).x);
            // https://cgg.mff.cuni.cz/~jaroslav/papers/2007-sketch-fis/Final_sap_0073.pdf
            return 0.5 * log2( 6.0 * size * size / (float(${sampleCount}) * pdf));
        }

        vec3 filterColor(vec3 N) {
            vec3  color  = vec3(0.0);
            float weight = 0.0;
            float roughness = float(${roughness});
            float lodBias   = float(${lodBias});

            for(int i = 0; i < ${sampleCount}; ++i) {
                vec4 importanceSample = getImportanceSample(i, N, roughness, ${distribution}, ${sampleCount});

                vec3 H    = vec3(importanceSample.xyz);
                float pdf = importanceSample.w;

                // mipmap filtered samples (GPU Gems 3, 20.4)
                float lod = computeLod(pdf);

                // apply the bias to the lod
                lod = lod +lodBias;

                // Note: reflect takes incident vector.
                vec3 V = N;
                vec3 L = normalize(reflect(-V, H));
                float NdotL = dot(N, L);

                if (NdotL > 0.0) {
                    if(roughness == 0.0) {
                        // without this the roughness=0 lod is too high
                        lod = lodBias;
                    }

                    vec3 sampleColor = textureLod(colorTexture, L, lod).rgb;
                    color  = color + sampleColor * NdotL;
                    weight = weight + NdotL;                    
                }
            }

            if(weight != 0.0) {
                color = color / weight;
            } else {
                color = color / float(${sampleCount});
            }

            return color.rgb;
        }
        
        void main(void) {
            g_finalColor = vec4(filterColor(cubeCoord(texCoord * 2.0 - 1.0, texLayer)), 1.0);
        }
    `;
    
    return { vertex, fragment };
}

export function generateLUT({ input: { sampleCount } }) {

    const vertex = fullscreenVert();
    
    const fragment = /* glsl */`#version 300 es
        precision mediump float;
        precision highp int; //this is needed for mobile devices

        in vec2 texCoord;
        flat in int texLayer;

        layout(location=0) out vec4 g_finalColor;

        ${formulasBlock}

        // Compute LUT for GGX/Charlie distributions.
        // See https://blog.selfshadow.com/publications/s2013-shading-course/karis/s2013_pbs_epic_notes_v2.pdf
        vec3 LUT(float NdotV, float roughness) {
            
            // Compute spherical view vector: (sin(phi), 0, cos(phi))
            vec3 V = vec3(sqrt(1.0 - NdotV * NdotV), 0.0, NdotV);

            // The macro surface normal just points up.
            vec3 N = vec3(0.0, 0.0, 1.0);

            // To make the LUT independant from the material's F0, which is part of the Fresnel term
            // when substituted by Schlick's approximation, we factor it out of the integral,
            // yielding to the form: F0 * I1 + I2
            // I1 and I2 are slighlty different in the Fresnel term, but both only depend on
            // NoL and roughness, so they are both numerically integrated and written into two channels.
            
            float A = 0.0;
            float B = 0.0;
            float C = 0.0;

            
            
            for(int i = 0; i < ${sampleCount}; ++i) {
                // LUT for GGX distribution.
                vec4 importanceSample = getImportanceSample(i, N, roughness, ${GGX}, ${sampleCount});

                vec3 H = importanceSample.xyz;
                vec3 L = normalize(reflect(-V, H));

                float NdotL = saturate(L.z);
                float NdotH = saturate(H.z);
                float VdotH = saturate(dot(V, H));
                if (NdotL > 0.0) {
                    // Taken from: https://bruop.github.io/ibl
                    // Shadertoy: https://www.shadertoy.com/view/3lXXDB
                    // Terms besides V are from the GGX PDF we're dividing by.
                    float V_pdf = V_SmithGGXCorrelated(NdotV, NdotL, roughness) * VdotH * NdotL / NdotH;
                    float Fc = pow(1.0 - VdotH, 5.0);
                    A = A + (1.0 - Fc) * V_pdf;
                    B = B + Fc * V_pdf;
                }

                // LUT for Charlie distribution.
                importanceSample = getImportanceSample(i, N, roughness, ${CHARLIE}, ${sampleCount});

                H = importanceSample.xyz;
                L = normalize(reflect(-V, H));

                NdotL = saturate(L.z);
                NdotH = saturate(H.z);
                VdotH = saturate(dot(V, H));
                if (NdotL > 0.0) {
                    float sheenDistribution = D_Charlie(roughness, NdotH);
                    float sheenVisibility = V_Ashikhmin(NdotL, NdotV);

                    C = C + sheenVisibility * sheenDistribution * NdotL * VdotH;
                }
            }

            // The PDF is simply pdf(v, h) -> NDF * <nh>.
            // To parametrize the PDF over l, use the Jacobian transform, yielding to: pdf(v, l) -> NDF * <nh> / 4<vh>
            // Since the BRDF divide through the PDF to be normalized, the 4 can be pulled out of the integral.
            return vec3(4.0 * A, 4.0 * B, 4.0 * 2.0 * ${M_PI} * C) / float(${sampleCount});
        }

        void main(void) {
            g_finalColor = vec4(LUT(texCoord.x, texCoord.y), 1.0);
        }
    `;
    return { vertex, fragment };
}

export default generate;