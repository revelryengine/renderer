/**
 * This shader code comes from the glTF Sample Viewer code base.
 * @see https://github.com/KhronosGroup/glTF-Sample-Viewer/tree/f38421f/source/Renderer/shaders
 * 
 * Modifications:
 * - @modification-shadows Added support for shadow maps
 * - @modification-instance Added support for instanced rendering
 * - @modification-frustum-ubo Added support for using uniform buffers for frustum
 * - @modification-lighting-ubo Added support for using uniform buffers for lighting
 * - @modification-skinning-texture Added support for using textures for skinning
 */

import { animation } from './animation.glsl.js';
import { frustum   } from '../frustum.glsl.js';
import { lighting  } from '../lighting.glsl.js';

const glsl = String.raw; // For syntax-highlighting
export const vertexShader = glsl`
/********** primitive.vert.js **********/

precision mediump int;
precision highp sampler2DArray;

/************  @modification-frustum-ubo [1/1]****************/
///uniform mat4 u_ViewProjectionMatrix;
${frustum}
/************  /@modification-frustum-ubo [1/1]****************/

/************  @modification-lighting-ubo [1/1]****************/
#ifdef USE_PUNCTUAL
${lighting}
#endif
/************  /@modification-lighting-ubo [1/1]****************/



/************  @modification-instance [1/2]****************/
// uniform mat4 u_ModelMatrix;
// uniform mat4 u_NormalMatrix;
layout(location = 0) in uvec4 a_instanceData; //primitive:node:model:skin
flat out uvec2 v_PrimitiveId;

// precision highp sampler2DArray; //this needs to be higher up for some reason on some drivers
uniform highp sampler2DArray u_InstanceSampler;
out mat4 v_ModelMatrix;

// layout(location = 1) in mat4 a_modelMatrix;
//find replace u_ModelMatrix -> a_modelMatrix below
/************  /@modification-instance [1/2]****************/

${animation}

/************  @modification-shadows [1/2]****************/
#ifdef USE_SHADOWS
// uniform mat4 u_ShadowMatrices[12];
out vec4 v_ShadowTexcoords[12]; //max shadows
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
out vec3 v_Normal;
#ifdef HAS_TANGENT_VEC4
out vec3 v_Tangent;
out vec3 v_Bitangent;
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

/************  @modification-skinning-texture [1/1]****************/
// vec4 getPosition()
// {
//     vec4 pos = vec4(a_position, 1.0);

// #ifdef USE_MORPHING
//     pos += getTargetPosition();
// #endif

// #ifdef USE_SKINNING
//     pos = getSkinningMatrix() * pos;
// #endif

//     return pos;
// }


// #ifdef HAS_NORMAL_VEC3
// vec3 getNormal()
// {
//     vec3 normal = a_normal;

// #ifdef USE_MORPHING
//     normal += getTargetNormal();
// #endif

// #ifdef USE_SKINNING
//     normal = mat3(getSkinningNormalMatrix()) * normal;
// #endif

//     return normalize(normal);
// }
// #endif


// #ifdef HAS_TANGENT_VEC4
// vec3 getTangent()
// {
//     vec3 tangent = a_tangent.xyz;

// #ifdef USE_MORPHING
//     tangent += getTargetTangent();
// #endif

// #ifdef USE_SKINNING
//     tangent = mat3(getSkinningMatrix()) * tangent;
// #endif

//     return normalize(tangent);
// }
// #endif
struct ModelInfo {
    int jointIndex;
    int jointCount;
    #ifdef USE_MORPHING
    mat4 morphWeights;
    #endif
};

vec4 getPosition(ModelInfo model)
{
    vec4 pos = vec4(a_position, 1.0);

#ifdef USE_MORPHING
    pos += getTargetPosition(model.morphWeights);
#endif

    if(model.jointCount > 0) {
        pos = getSkinningMatrix(model.jointIndex) * pos;
    }

    return pos;
}


#ifdef HAS_NORMAL_VEC3
vec3 getNormal(ModelInfo model)
{
    vec3 normal = a_normal;

#ifdef USE_MORPHING
    normal += getTargetNormal(model.morphWeights);
#endif

    if(model.jointCount > 0) {
        normal = mat3(getSkinningNormalMatrix(model.jointIndex, model.jointCount)) * normal;
    }

    return normalize(normal);
}
#endif


#ifdef HAS_TANGENT_VEC4
vec3 getTangent(ModelInfo model)
{
    vec3 tangent = a_tangent.xyz;

#ifdef USE_MORPHING
    tangent += getTargetTangent(model.morphWeights);
#endif

    if(model.jointCount > 0) {
        tangent = mat3(getSkinningMatrix(model.jointIndex)) * tangent;
    }

    return normalize(tangent);
}
#endif
/************  /@modification-skinning-texture [1/1]****************/

void main()
{
    /************  @modification-instance [2/2]****************/
    //v_ModelMatrix = a_modelMatrix;
    v_ModelMatrix = readMatrix(u_InstanceSampler, int(a_instanceData.z));
    v_PrimitiveId = a_instanceData.xy;

    ModelInfo model;

    model.jointIndex = int(a_instanceData.w) >> 8;
    model.jointCount = int(a_instanceData.w) & 255;
    
    #ifdef USE_MORPHING
    model.morphWeights = readMatrix(u_InstanceSampler, int(a_instanceData.z) + 1);
    #endif

    mat4 normalMatrix = transpose(inverse(v_ModelMatrix));

    //find replace u_NormalMatrix -> normalMatrix below
    /************  /@modification-instance [2/2]****************/
    vec4 pos = v_ModelMatrix * getPosition(/* @modification-skinning-texture */model);
    v_Position = vec3(pos.xyz) / pos.w;

    /************  @modification-shadows [2/2]****************/
    #ifdef USE_SHADOWS
    for (int i = 0; i < u_ShadowCount; ++i) {
        v_ShadowTexcoords[i] = u_ShadowMatrices[i] * pos;
    }
    #endif
    /************  /@modification-shadows [2/2]****************/

#ifdef HAS_NORMAL_VEC3
#ifdef HAS_TANGENT_VEC4
    vec3 tangent = getTangent(/* @modification-skinning-texture */model);
    vec3 normalW = normalize(vec3(normalMatrix * vec4(getNormal(/* @modification-skinning-texture */model), 0.0)));
    vec3 tangentW = normalize(vec3(v_ModelMatrix * vec4(tangent, 0.0)));
    vec3 bitangentW = cross(normalW, tangentW) * a_tangent.w;
    v_Tangent   = tangentW;
    v_Bitangent = bitangentW;
    v_Normal    = normalW;
#else
    v_Normal = normalize(vec3(normalMatrix * vec4(getNormal(/* @modification-skinning-texture */model), 0.0)));
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
/********** /primitive.vert.js **********/
`;

export default vertexShader;
