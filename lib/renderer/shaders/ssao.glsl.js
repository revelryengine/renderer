const glsl = String.raw; // For syntax-highlighting
export const ssao = glsl`
/********** ssao.glsl.js **********/



float getClipDepth(float d) 
{
    float ndcDepth = (2.0 * d - gl_DepthRange.near - gl_DepthRange.far) / (gl_DepthRange.far - gl_DepthRange.near);
    float clipDepth = ndcDepth / gl_FragCoord.w;
    return (clipDepth * 0.5) + 0.5;
}

#ifdef USE_SSAO



uniform sampler2D u_SSAODepthSampler;
uniform sampler2D u_SSAONoiseSampler;

uniform vec2 u_SSAONoiseScale;
uniform float u_SSAORadius;
uniform vec3 u_SSAOKernel[SSAO_KERNEL_SIZE];

const vec2 offset1 = vec2(0.0, 0.001);
const vec2 offset2 = vec2(0.001, 0.0);

vec3 normal_from_depth(float depth, vec2 texcoords) 
{
    float depth1 = texture(u_SSAODepthSampler, texcoords + offset1).r;
    float depth2 = texture(u_SSAODepthSampler, texcoords + offset2).r;
    
    vec3 p1 = vec3(offset1, depth1 - depth);
    vec3 p2 = vec3(offset2, depth2 - depth);
    
    vec3 normal = cross(p1, p2);
    normal.z = -normal.z;
    
    return normalize(normal);
}

float calculateSSAO(vec3 norm, vec3 position, mat4 viewMatrix, mat4 projMatrix)
{   
    vec4 ncdPos = projMatrix * viewMatrix * vec4(position, 1.0);
    vec3 origin = ncdPos.xyz / ncdPos.w;

    vec4 viewN  = projMatrix * viewMatrix * u_ModelMatrix * vec4(norm, 1.0);
    vec3 n  = viewN.xyz / viewN.w;

    vec3 rvec = texture(u_SSAONoiseSampler, gl_FragCoord.xy * u_SSAONoiseScale).xyz * 2.0 - 1.0;

    vec3 tangent = normalize(rvec - n * dot(rvec, n));
    vec3 bitangent = cross(n, tangent);
    mat3 tbn = mat3(tangent, bitangent, n);

    float occlusion = 0.0;

    for(int i = 0; i < SSAO_KERNEL_SIZE; ++i)
    {
        vec3 samplePoint = tbn * u_SSAOKernel[i];
        samplePoint = samplePoint * u_SSAORadius + origin;
        
        vec4 offset = vec4(samplePoint, 1.0);
        offset = projMatrix * viewMatrix * offset;
        offset.xy /= offset.w;
        offset.xy = offset.xy * 0.5 + 0.5;

        float sampleDepth = texture(u_SSAODepthSampler, offset.xy).r;
        float rangeCheck= abs(origin.z - sampleDepth) < u_SSAORadius ? 1.0 : 0.0;
        occlusion += (sampleDepth >= samplePoint.z ? 1.0 : 0.0) * rangeCheck;
    }

    return 1.0 - (occlusion / float(SSAO_KERNEL_SIZE));
}

#endif
/********** /ssao.glsl.js **********/
`;

export default ssao;