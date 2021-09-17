/**
 * This shader code comes from the glTF Sample Viewer code base.
 * @see https://github.com/KhronosGroup/glTF-Sample-Viewer/tree/f38421f/source/Renderer/shaders
 * 
 * Modifications:
 * - @modification-shadows Added support for shadow maps
 * - @modification-instance Added support for instanced rendering
 * - @modification-frustum-ubo Added support for using uniform buffers for frustum
 */

import { animation } from './animation.glsl.js';
import { frustum   } from '../frustum.glsl.js';

const glsl = String.raw; // For syntax-highlighting
export const vertexShader = glsl`
/********** primitive.vert.js **********/
${animation}

/************  @modification-frustum-ubo [1/1]****************/
///uniform mat4 u_ViewProjectionMatrix;
${frustum}
/************  /@modification-frustum-ubo [1/1]****************/

/************  @modification-instance [1/2]****************/
// uniform mat4 u_ModelMatrix;
// uniform mat4 u_NormalMatrix;
layout(location = 0) in uvec2 a_primitiveId; //primitive:node ids
flat out uvec2 v_PrimitiveId;

layout(location = 1) in mat4 a_modelMatrix;
out mat4 v_ModelMatrix;

//find replace u_ModelMatrix -> a_modelMatrix below
/************  /@modification-instance [1/2]****************/

/************  @modification-shadows [1/2]****************/
#ifdef USE_SHADOWS
uniform mat4 u_ShadowMatrices[SHADOW_COUNT];
out vec4 v_ShadowTexcoords[SHADOW_COUNT];
#endif
/************  /@modification-shadows [1/2]****************/

in vec3 a_position;
out vec3 v_Position;

#ifdef HAS_NORMAL_VEC3
in vec3 a_normal;
#endif

#ifdef HAS_TANGENT_VEC4
in vec4 a_tangent;
#endif

#ifdef HAS_NORMAL_VEC3
#ifdef HAS_TANGENT_VEC4
out mat3 v_TBN;
#else
out vec3 v_Normal;
#endif
#endif

#ifdef HAS_TEXCOORD_0_VEC2
in vec2 a_texcoord_0;
#endif

#ifdef HAS_TEXCOORD_1_VEC2
in vec2 a_texcoord_1;
#endif

out vec2 v_texcoord_0;
out vec2 v_texcoord_1;

#ifdef HAS_COLOR_0_VEC3
in vec3 a_color_0;
out vec3 v_Color;
#endif

#ifdef HAS_COLOR_0_VEC4
in vec4 a_color_0;
out vec4 v_Color;
#endif


vec4 getPosition()
{
    vec4 pos = vec4(a_position, 1.0);

#ifdef USE_MORPHING
    pos += getTargetPosition();
#endif

#ifdef USE_SKINNING
    pos = getSkinningMatrix() * pos;
#endif

    return pos;
}


#ifdef HAS_NORMAL_VEC3
vec3 getNormal()
{
    vec3 normal = a_normal;

#ifdef USE_MORPHING
    normal += getTargetNormal();
#endif

#ifdef USE_SKINNING
    normal = mat3(getSkinningNormalMatrix()) * normal;
#endif

    return normalize(normal);
}
#endif


#ifdef HAS_TANGENT_VEC4
vec3 getTangent()
{
    vec3 tangent = a_tangent.xyz;

#ifdef USE_MORPHING
    tangent += getTargetTangent();
#endif

#ifdef USE_SKINNING
    tangent = mat3(getSkinningMatrix()) * tangent;
#endif

    return normalize(tangent);
}
#endif


void main()
{
    /************  @modification-instance [2/2]****************/
    v_ModelMatrix = a_modelMatrix;
    v_PrimitiveId = a_primitiveId;

    mat4 normalMatrix = transpose(inverse(a_modelMatrix)); //don't want to waste 4 attribute slots so just calculate it here
    //find replace u_NormalMatrix -> normalMatrix below
    /************  /@modification-instance [2/2]****************/
    vec4 pos = a_modelMatrix * getPosition();
    v_Position = vec3(pos.xyz) / pos.w;

    /************  @modification-shadows [2/2]****************/
    #ifdef USE_SHADOWS
    for (int i = 0; i < SHADOW_COUNT; ++i) {
        v_ShadowTexcoords[i] = u_ShadowMatrices[i] * pos;
    }
    #endif
    /************  /@modification-shadows [2/2]****************/

#ifdef HAS_NORMAL_VEC3
#ifdef HAS_TANGENT_VEC4
    vec3 tangent = getTangent();
    vec3 normalW = normalize(vec3(normalMatrix * vec4(getNormal(), 0.0)));
    vec3 tangentW = normalize(vec3(a_modelMatrix * vec4(tangent, 0.0)));
    vec3 bitangentW = cross(normalW, tangentW) * a_tangent.w;
    v_TBN = mat3(tangentW, bitangentW, normalW);
#else
    v_Normal = normalize(vec3(normalMatrix * vec4(getNormal(), 0.0)));
#endif
#endif

    v_texcoord_0 = vec2(0.0, 0.0);
    v_texcoord_1 = vec2(0.0, 0.0);

#ifdef HAS_TEXCOORD_0_VEC2
    v_texcoord_0 = a_texcoord_0;
#endif

#ifdef HAS_TEXCOORD_1_VEC2
    v_texcoord_1 = a_texcoord_1;
#endif

#if defined(HAS_COLOR_0_VEC3) || defined(HAS_COLOR_0_VEC4)
    v_Color = a_color_0;
#endif

    gl_Position = u_ViewProjectionMatrix * pos;
}
/********** primitive.vert.js **********/
`;

export default vertexShader;