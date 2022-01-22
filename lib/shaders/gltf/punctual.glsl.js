/**
 * This shader code comes from the glTF Sample Viewer code base.
 * @see https://github.com/KhronosGroup/glTF-Sample-Viewer/tree/f38421f/source/Renderer/shaders
 * 
 * Modifications:
 *  - @modification-shadows Addes support for shadow maps
 *  - @modification-lighting-ubo Added for using uniform buffers for lighting
 */

const glsl = String.raw; // For syntax-highlighting
export const punctual = glsl`
/********** punctual.glsl.js **********/
// KHR_lights_punctual extension.
// see https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_lights_punctual

/************  @modification-shadows [1/3]****************/
#ifdef USE_SHADOWS
precision highp sampler2DArrayShadow;
uniform sampler2DArrayShadow u_ShadowSamplers;
// uniform float u_ShadowSplits[5];
in vec4 v_ShadowTexcoords[12];
#endif
/************  /@modification-shadows [1/3]****************/

/************  @modification-lighting-ubo [1/1]****************/
// struct Light
// {
//     vec3 direction;
//     float range;

//     vec3 color;
//     float intensity;

//     vec3 position;
//     float innerConeCos;

//     float outerConeCos;
//     int type;

//     /************  @modification-shadows [2/3]****************/
//     int shadowLayer;
//     /************  /@modification-shadows [2/3]****************/
// };

// #ifdef USE_PUNCTUAL
// // uniform int u_LightCount;
// uniform Light u_Lights[24]; //Array [0] is not allowed
// #endif
/************  /@modification-lighting-ubo [1/1]****************/

#ifdef USE_PUNCTUAL
const int LightType_Directional = 0;
const int LightType_Point = 1;
const int LightType_Spot = 2;


// https://github.com/KhronosGroup/glTF/blob/master/extensions/2.0/Khronos/KHR_lights_punctual/README.md#range-property
float getRangeAttenuation(float range, float distance)
{
    if (range <= 0.0)
    {
        // negative range means unlimited
        return 1.0 / pow(distance, 2.0);
    }
    return max(min(1.0 - pow(distance / range, 4.0), 1.0), 0.0) / pow(distance, 2.0);
}


// https://github.com/KhronosGroup/glTF/blob/master/extensions/2.0/Khronos/KHR_lights_punctual/README.md#inner-and-outer-cone-angles
float getSpotAttenuation(vec3 pointToLight, vec3 spotDirection, float outerConeCos, float innerConeCos)
{
    float actualCos = dot(normalize(spotDirection), normalize(-pointToLight));
    if (actualCos > outerConeCos)
    {
        if (actualCos < innerConeCos)
        {
            return smoothstep(outerConeCos, innerConeCos, actualCos);
        }
        return 1.0;
    }
    return 0.0;
}


vec3 getLighIntensity(Light light, vec3 pointToLight)
{
    float rangeAttenuation = 1.0;
    float spotAttenuation = 1.0;

    if (light.type != LightType_Directional)
    {
        rangeAttenuation = getRangeAttenuation(light.range, length(pointToLight));
    }
    if (light.type == LightType_Spot)
    {
        spotAttenuation = getSpotAttenuation(pointToLight, light.direction, light.outerConeCos, light.innerConeCos);
    }

    return rangeAttenuation * spotAttenuation * light.intensity * light.color;
}


vec3 getPunctualRadianceTransmission(vec3 normal, vec3 view, vec3 pointToLight, float alphaRoughness,
    vec3 f0, vec3 f90, vec3 baseColor, float ior)
{
    float transmissionRougness = applyIorToRoughness(alphaRoughness, ior);

    vec3 n = normalize(normal);           // Outward direction of surface point
    vec3 v = normalize(view);             // Direction from surface point to view
    vec3 l = normalize(pointToLight);
    vec3 l_mirror = normalize(l + 2.0*n*dot(-l, n));     // Mirror light reflection vector on surface
    vec3 h = normalize(l_mirror + v);            // Halfway vector between transmission light vector and v

    float D = D_GGX(clamp(dot(n, h), 0.0, 1.0), transmissionRougness);
    vec3 F = F_Schlick(f0, f90, clamp(dot(v, h), 0.0, 1.0));
    float Vis = V_GGX(clamp(dot(n, l_mirror), 0.0, 1.0), clamp(dot(n, v), 0.0, 1.0), transmissionRougness);

    // Transmission BTDF
    return (1.0 - F) * baseColor * D * Vis;
}


vec3 getPunctualRadianceClearCoat(vec3 clearcoatNormal, vec3 v, vec3 l, vec3 h, float VdotH, vec3 f0, vec3 f90, float clearcoatRoughness)
{
    float NdotL = clampedDot(clearcoatNormal, l);
    float NdotV = clampedDot(clearcoatNormal, v);
    float NdotH = clampedDot(clearcoatNormal, h);
    return NdotL * BRDF_specularGGX(f0, f90, clearcoatRoughness * clearcoatRoughness, 1.0, VdotH, NdotL, NdotV, NdotH);
}


vec3 getPunctualRadianceSheen(vec3 sheenColor, float sheenRoughness, float NdotL, float NdotV, float NdotH)
{
    return NdotL * BRDF_specularSheen(sheenColor, sheenRoughness, NdotL, NdotV, NdotH);
}


// Compute attenuated light as it travels through a volume.
vec3 applyVolumeAttenuation(vec3 radiance, float transmissionDistance, vec3 attenuationColor, float attenuationDistance)
{
    if (attenuationDistance == 0.0)
    {
        // Attenuation distance is +∞ (which we indicate by zero), i.e. the transmitted color is not attenuated at all.
        return radiance;
    }
    else
    {
        // Compute light attenuation using Beer's law.
        vec3 attenuationCoefficient = -log(attenuationColor) / attenuationDistance;
        vec3 transmittance = exp(-attenuationCoefficient * transmissionDistance); // Beer's law
        return transmittance * radiance;
    }
}


vec3 getVolumeTransmissionRay(vec3 n, vec3 v, float thickness, float ior, mat4 modelMatrix)
{
    // Direction of refracted light.
    vec3 refractionVector = refract(-v, normalize(n), 1.0 / ior);

    // Compute rotation-independant scaling of the model matrix.
    vec3 modelScale;
    modelScale.x = length(vec3(modelMatrix[0].xyz));
    modelScale.y = length(vec3(modelMatrix[1].xyz));
    modelScale.z = length(vec3(modelMatrix[2].xyz));

    // The thickness is specified in local space.
    return normalize(refractionVector) * thickness * modelScale;
}

/************  @modification-shadows [2/2]****************/
#ifdef USE_SHADOWS

float offsetLookup(float shadowLayer, vec4 texcoord, vec2 offset)
{
    vec2 texelSize = vec2(textureSize(u_ShadowSamplers, 0).xy);
    texcoord.xyz /= texcoord.w;
    texcoord.xy += offset / texelSize;
    texcoord.w = texcoord.z;
    texcoord.z = shadowLayer;
    return texture(u_ShadowSamplers, texcoord);
}

float shadowPCF(int shadowLayer, float bias) 
{
    vec4 texcoord   = v_ShadowTexcoords[shadowLayer];
    texcoord.z -= bias;

    // Apply PCF
    float sum = 0.0; float x, y; 
    for (y = -1.5; y <= 1.5; y += 1.0)
    {
        for (x = -1.5; x <= 1.5; x += 1.0)
        {
            sum += offsetLookup(float(shadowLayer), texcoord, vec2(x, y)); 
        }
    }
    return sum / 16.0; 
}

vec2 getShadowCascade() 
{
    int layer = 0;
    float blend = 0.0;

    float depth = getLinearDepth(gl_FragCoord.z * 0.5 + 0.5);
    for(int i = 0; i < SHADOW_CASCADES; i++)
    {
        if(depth < u_ShadowSplits[i + 1])
        {
            blend = smoothstep(0.95, 1.0, depth / u_ShadowSplits[i + 1]);
            layer = i;
            break;
        }
    }
    return vec2(float(layer), blend);
}

float getShadowFactor(Light light, float NdotL)
{   
    if(light.type == LightType_Point)
    {
        return 1.0;
    }

    int layer = light.shadowLayer;
    float blend = 0.0;
    float bias = clamp(0.0005 * tan(acos(NdotL)), 0.0, 0.001); //apply slight additional bias to reduce artifacts

    if(light.type == LightType_Directional)
    {
        vec2 shadowCascade = getShadowCascade();
        layer += int(shadowCascade.x);
        blend = shadowCascade.y;
    }
    
    if(blend > 0.0) {
        float nearShadow = shadowPCF(layer, bias);
        float farShadow  = shadowPCF(layer + 1, bias);

        return mix(nearShadow, farShadow, blend);
    } else {
        int shadowLayer = layer;
        return shadowPCF(shadowLayer, bias);
    }
}

#else

float getShadowFactor(Light light, float NdotL)
{
    return 1.0;
}
#endif
/************  /@modification-shadows [2/2]****************/

#endif
/********** /punctual.glsl.js **********/
`;

export default punctual;