/**
 * This shader is a modified version of the Khronos Group glTF Sample Viewer shaders.
 * Modified to align variable names with glTF spec property names to minimize the amount of preprocessing and logic
 * before offloading to the shader.
 **/

import { skinning } from './skinning.glsl.js';
import { morphing } from './morphing.glsl.js';

export const vertexShader = /* glsl */`
/********** vertex.glsl.js **********/
${skinning}
${morphing}

attribute vec4 a_POSITION;
varying vec3 v_position;
varying vec2 v_uvCoord0;
varying vec2 v_uvCoord1;

#ifdef HAS_NORMAL
  attribute vec4 a_NORMAL;
#endif

#ifdef HAS_TANGENT
  attribute vec4 a_TANGENT;
#endif

#ifdef HAS_TEXCOORD_0
  attribute vec2 a_TEXCOORD_0;
#endif

#ifdef HAS_TEXCOORD_1
  attribute vec2 a_TEXCOORD_1;
#endif

#ifdef HAS_COLOR_0
  attribute vec4 a_COLOR_0;
#endif

#ifdef COLOR_0_TYPE_VEC3
  varying vec3 v_color;
#endif

#ifdef COLOR_0_TYPE_VEC4
 varying vec4 v_color;
#endif

uniform mat4 u_viewProjectionMatrix;
uniform mat4 u_modelMatrix;
uniform mat4 u_normalMatrix;

#ifdef HAS_NORMAL
  #ifdef HAS_TANGENT
    varying mat3 v_tbn;
  #else
    varying vec3 v_normal;
  #endif
#endif

vec4 getPosition() {
  vec4 pos = a_POSITION;

  #ifdef USE_MORPHING
    pos += getTargetPosition();
  #endif

  #ifdef USE_SKINNING
    pos = getSkinningMatrix() * pos;
  #endif

  return pos;
}

#ifdef HAS_NORMAL
  vec4 getNormal() {
    vec4 normal = a_NORMAL;

    #ifdef USE_MORPHING
      normal += getTargetNormal();
    #endif

    #ifdef USE_SKINNING
      normal = getSkinningNormalMatrix() * normal;
    #endif

    return normalize(normal);
  }
#endif

#ifdef HAS_TANGENT
  vec4 getTangent() {
    vec4 tangent = a_TANGENT;

    #ifdef USE_MORPHING
      tangent += getTargetTangent();
    #endif

    #ifdef USE_SKINNING
      tangent = getSkinningMatrix() * tangent;
    #endif

    return normalize(tangent);
  }
#endif


void main() {
  vec4 pos = u_modelMatrix * getPosition();
  v_position = vec3(pos.xyz) / pos.w;
  #ifdef HAS_NORMAL
    #ifdef HAS_TANGENT
      vec4 tangent = getTangent();
      vec3 normalW = normalize(vec3(u_normalMatrix * vec4(getNormal().xyz, 0.0)));
      vec3 tangentW = normalize(vec3(u_modelMatrix * vec4(tangent.xyz, 0.0)));
      vec3 bitangentW = cross(normalW, tangentW) * tangent.w;
      v_tbn = mat3(tangentW, bitangentW, normalW);
    #else
      v_normal = normalize(vec3(u_modelMatrix * vec4(getNormal().xyz, 0.0)));
    #endif
  #endif

  v_uvCoord0 = vec2(0.0, 0.0);
  v_uvCoord1 = vec2(0.0, 0.0);

  #ifdef HAS_TEXCOORD_0
    v_uvCoord0 = a_TEXCOORD_0;
  #endif

  #ifdef HAS_TEXCOORD_1
    v_uvCoord1 = a_TEXCOORD_1;
  #endif

  #ifdef HAS_COLOR_0
    v_color = a_COLOR_0;
  #endif

  gl_Position = u_viewProjectionMatrix * pos;
}
/********** /vertex.glsl.js **********/
`;

export default vertexShader;
