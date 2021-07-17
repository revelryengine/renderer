/**
 * @see https://learnopengl.com/Advanced-Lighting/SSAO
 * @see https://mynameismjp.wordpress.com/2010/09/05/position-from-depth-3/
 * @see https://www.derschmale.com/2014/01/26/reconstructing-positions-from-the-depth-buffer/
 * @see https://www.khronos.org/opengl/wiki/Compute_eye_space_from_window_space
 */
const glsl = String.raw; // For syntax-highlighting
export const fragmentShader = glsl`
/********** ssao.frag.js **********/
precision highp float;

uniform sampler2D u_DepthSampler;
uniform sampler2D u_NoiseSampler;
uniform sampler2D u_NormalSampler;

uniform vec2  u_NoiseScale;
uniform float u_Radius;
uniform float u_Bias;
uniform vec3  u_Kernel[SSAO_KERNEL_SIZE];

uniform mat4 u_ProjectionMatrix;
uniform vec2 u_HalfSizeNearPlane;

uniform float u_ZNear;
uniform float u_ZFar;

in vec2 v_TexCoord;
in vec3 v_ViewRay;

out vec4 g_finalColor;

float linearDepth(float depthSample)
{
    depthSample = 2.0 * depthSample - 1.0;
    float zLinear = 2.0 * u_ZNear * u_ZFar / (u_ZFar + u_ZNear - depthSample * (u_ZFar - u_ZNear));
    return zLinear;
}

void main(void) 
{    
    vec3 fragPos   = v_ViewRay * linearDepth(texture(u_DepthSampler, v_TexCoord).x);

    vec3 normal    = texture(u_NormalSampler, v_TexCoord).rgb;

    vec3 randomVec = texture(u_NoiseSampler, v_TexCoord * u_NoiseScale).xyz; 
    vec3 tangent   = normalize(randomVec - normal * dot(randomVec, normal));
    vec3 bitangent = cross(normal, tangent);
    mat3 TBN       = mat3(tangent, bitangent, normal);

    float occlusion = 0.0;
    for(int i = 0; i < SSAO_KERNEL_SIZE; ++i)
    {
        // get sample position
        vec3 samplePos = TBN * u_Kernel[i]; // from tangent to view-space
        samplePos = fragPos + samplePos * u_Radius; 
        
        vec4 offset = vec4(samplePos, 1.0);
        offset      = u_ProjectionMatrix * offset;    // from view to clip-space
        offset.xyz /= offset.w;               // perspective divide
        offset.xyz  = offset.xyz * 0.5 + 0.5; // transform to range 0.0 - 1.0  

        vec3 viewRay = vec3((2.0 * u_HalfSizeNearPlane * offset.xy) - u_HalfSizeNearPlane, -1.0);

        float sampleDepth = (viewRay * linearDepth(texture(u_DepthSampler, offset.xy).x)).z;
        float rangeCheck  = smoothstep(0.0, 1.0, u_Radius / abs(fragPos.z - sampleDepth));

        occlusion += (sampleDepth >= samplePos.z + u_Bias ? 1.0 : 0.0) * rangeCheck;      
    }  

    occlusion = 1.0 - (occlusion / float(SSAO_KERNEL_SIZE));
    g_finalColor = vec4(vec3(occlusion), 1.0);
}
/********** ssao.frag.js **********/
`;

export default fragmentShader;
