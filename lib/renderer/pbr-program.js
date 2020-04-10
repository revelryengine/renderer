import { extensions } from '../webgltf.js';
import { Program    } from './program.js';

import { vertexShader   } from './shaders/vertex.glsl.js';
import { fragmentShader } from './shaders/fragment.glsl.js';

/**
 * A standard physically based rendering program.
 */
export class PBRProgram extends Program {
  /**
   * Creates an instance of PBRProgram from a {@link Primitive}.
   * @param {WebGLRenderingContext} context - The WebGL Rendering Context.
   * @param {Object} params - The PBRProgram parameters
   */
  constructor(context, { primitive, lights = [], ibl, glExtensions = {}, jointCount = 0 }) {
    const { attributes, targets = [], material = { extensions: {} } } = primitive;
    const { pbrMetallicRoughness = {}, alphaMode, doubleSided } = material;

    const textures = Object.fromEntries(Object.entries({ ...material, ...pbrMetallicRoughness }).filter(([name, value]) => {
      return value && name.endsWith('Texture');
    }));

    const define = {
      USE_IBL: ibl ? 1 : 0,
      USE_PUNCTUAL: lights.length ? 1 : 0,
      LIGHT_COUNT: lights.length,

      USE_TEX_LOD: glExtensions.EXT_shader_texture_lod ? 1 : 0,
      IS_DOUBLESIDED: doubleSided ? 1 : 0,
      JOINT_COUNT: jointCount,
      WEIGHT_COUNT: targets.reduce((count, target) => count + Object.keys(target).length, 0),
      [`ALPHAMODE_${alphaMode}`]: 1,
      // DEBUG_OUTPUT: 1,
      // DEBUG_ALPHA: 1,
      // DEBUG_EMISSIVE: 1,
      // DEBUG_METALLIC: 1,
      // DEBUG_ROUGHNESS: 1,
      // DEBUG_NORMAL: 1,
      // DEBUG_BASECOLOR: 1,
      // DEBUG_OCCLUSION: 1,
      // DEBUG_FO: 1
    };

    for(const [name, ext] of Object.entries(material.extensions)) {
      define[`HAS_${name.toUpperCase()}`] = 1;
      for(const [prop, value] of Object.entries(ext)) {
        if(prop.endsWith('Texture')) {
          const c = `HAS_${name.toUpperCase()}_${prop.toUpperCase()}`;
          define[c] = 1;
          if(value && value.extensions && value.extensions.KHR_texture_transform) {
            define[`${c}_TRANSFORM`] = 1;
          }
        }
      }
    }

    if(attributes.COLOR_0) {
      define[`COLOR_0_TYPE_${attributes.COLOR_0.type.toUpperCase()}`] = 1;
    }

    for(const name of Object.keys(attributes)) {
      define[`HAS_${name.toUpperCase()}`] = 1;
    }

    for(const [name, texture] of Object.entries(textures)) {
      define[`HAS_${name.toUpperCase()}`] = 1;
      if(extensions.has('KHR_texture_transform') && texture.extensions.KHR_texture_transform) {
        define[`HAS_${name.toUpperCase()}_TRANSFORM`] = 1;
      }
    }

    for(let i = 0; i < targets.length; i++) {
      for(const name of Object.keys(targets[i])) {
        define[`HAS_TARGET_${i}_${name}`] = 1;
      }
    }

    for (const [key, value] of Object.entries(define)) {
      if (!value) delete define[key];
    }
    // console.log(define);
    super(context, vertexShader, fragmentShader, define);
  }

  run(
    primitive,
    camera, modelMatrix, viewProjectionMatrix, normalMatrix,
    jointMatrices,
    jointNormalMatrices,
    morphWeights,
    lights,
    ibl,
  ) {
    super.run();

    const { context } = this;

    this.uniforms.set('u_camera', camera);
    this.uniforms.set('u_exposure', 1);

    this.uniforms.set('u_modelMatrix', modelMatrix);
    this.uniforms.set('u_viewProjectionMatrix', viewProjectionMatrix);
    this.uniforms.set('u_normalMatrix', normalMatrix);

    this.uniforms.set('u_jointMatrices', jointMatrices);
    this.uniforms.set('u_jointNormalMatrices', jointNormalMatrices);
    this.uniforms.set('u_morphWeights', morphWeights);
    this.uniforms.set('u_lights', lights);

    const { indices, attributes, mode, material = {}, targets = [] } = primitive;

    const {
      pbrMetallicRoughness = {},
      normalTexture, occlusionTexture, emissiveFactor, doubleSided, alphaMode, alphaCutoff
    } = material;

    const {
      baseColorFactor = [1, 1, 1, 1], metallicFactor = 1, roughnessFactor = 1
    } = pbrMetallicRoughness;

    for(const [name, attr] of Object.entries(attributes)) {
      this.attributes.set(`a_${name}`, attr);
    }

    for(let i = 0; i < targets.length; i++) {
      for(const [name, attr] of Object.entries(targets[i])) {
        this.attributes.set(`a_Target_${i}_${name}`, attr);
      }
    }


    for(const [name, texture] of Object.entries({ ...material, ...pbrMetallicRoughness })){
      if(texture && name.endsWith('Texture')) {
        this.uniforms.set(`u_${name}`, texture.getWebGLTexture(context));
        this.uniforms.set(`u_${name}_texCoord`, texture.texCoord);

        if(extensions.has('KHR_texture_transform') && texture.extensions.KHR_texture_transform) {
          const { texCoord } = texture.extensions.KHR_texture_transform;
          if(texCoord !== undefined) this.uniforms.set(`u_${name}_texCoord`, texCoord);
          this.uniforms.set(`u_${name}_transform`, texture.extensions.KHR_texture_transform.getTransform());
        }
      }
    }

    if (this.define['HAS_NORMALTEXTURE']) {
      this.uniforms.set('u_normalTexture_scale', normalTexture.scale);
    }
    if (this.define['HAS_OCCLUSIONTEXTURE']) {
      this.uniforms.set('u_occlusionTexture_strength', occlusionTexture.strength);
    }
    if (this.define['HAS_EMISSIVETEXTURE']) {
      this.uniforms.set('u_emissiveTexture_emissiveFactor', emissiveFactor);
    }

    if(material.extensions) {
      for(const [name, ext] of Object.entries(material.extensions)) {
        for(const [prop, value] of Object.entries(ext)) {
          if(value) {
            if(prop.endsWith('Texture')){
              this.uniforms.set(`u_${name}_${prop}`, value.getWebGLTexture(context));
              if(value.extensions && value.extensions.KHR_texture_transform) {
                const { texCoord } = value.extensions.KHR_texture_transform;
                if(texCoord !== undefined) this.uniforms.set(`u_${name}_${prop}_texCoord`, texCoord);
                this.uniforms.set(`u_${name}_${prop}_transform`, value.extensions.KHR_texture_transform.getTransform());
              }
            } else {
              this.uniforms.set(`u_${name}_${prop}`, value);
            }
          }
        }
      }
    }


    this.uniforms.set('u_baseColorFactor', baseColorFactor);
    this.uniforms.set('u_metallicFactor', metallicFactor);
    this.uniforms.set('u_roughnessFactor', roughnessFactor);
    this.uniforms.set('u_alphaCutoff', alphaCutoff);

    // if(ibl) {
    //   this.uniforms.set('u_IBL_texture', ibl.getWebGLTexture(context));
    //   for(const [name, value] of Object.entries(ibl)) {
    //     this.uniforms.set(`u_IBL_${name}`, value);
    //   }
    // }
    if (ibl) {
        this.uniforms.set('u_mipCount', ibl.mipCount);
        this.uniforms.set('u_brdfLUT', ibl.brdfTexture.getWebGLTexture(context));

        this.uniforms.set('u_diffuseEnvTexture', ibl.diffuseEnvTexture.getWebGLTexture(context));
        this.uniforms.set('u_scaleDiffBaseMR', [0.0, 0.0, 0.0, 0.0]);
        this.uniforms.set('u_scaleFGDSpec', [0.0, 0.0, 0.0, 0.0]);
        this.uniforms.set('u_scaleIBLAmbient', [0.5, 0.5, 0, 0]);

        this.uniforms.set('u_specularEnvTexture', ibl.specularEnvTexture.getWebGLTexture(context));
    }

    this.update();

    if (doubleSided) {
      context.disable(context.CULL_FACE);
    } else {
      context.enable(context.CULL_FACE);
    }

    if(alphaMode === 'BLEND') {
      context.enable(context.BLEND);
      context.blendFuncSeparate(context.SRC_ALPHA, context.ONE_MINUS_SRC_ALPHA, context.ONE, context.ONE_MINUS_SRC_ALPHA);
      context.blendEquation(context.FUNC_ADD);
    } else {
      context.disable(context.BLEND);
    }

    if (indices) {
      const { count, componentType, byteOffset } = indices;
      context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, indices.getWebGLBuffer(context, context.ELEMENT_ARRAY_BUFFER));
      context.drawElements(mode, count, componentType, byteOffset);
    } else {
      /**
       * If indices is not defined use drawArrays instead with a count from any of the attributes. They should all be the same.
       * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#meshes
       */
      const { count } = Object.values(attributes)[0];
      context.drawArrays(mode, 0, count);
    }
  }
}

export default PBRProgram;
