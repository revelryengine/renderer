import { extensions                      } from '../extensions.js';
import { GLTFProperty, NamedGLTFProperty } from '../gltf-property.js';

import './KHR_image_ktx2.js';
import './KHR_texture_basisu.js';

/**
 * @see https://github.com/KhronosGroup/glTF/tree/khr_ktx2_ibl/extensions/2.0/Khronos/KHR_lights_image_based
 */

/**
 * An image-based lighting environment.
 * @typedef {namedGLTFProperty} khrLightsImageBasedLight
 * @property {Number[]} [rotation=[0,0,0,1]] - Quaternion that represents the rotation of the IBL environment. It applies to both the specular and diffuse part.
 * @property {Number} [brightnessFactor=1] - Brightness multiplier for both the specular and diffuse part.
 * @property {Number} [brightnessOffset=0] - Brightness offset for both the specular and diffuse part. Offset is applied after the factor.
 * @property {Number} [specularEnvironmentTexture] - The prefiltered specular environment map.
 * @property {Number} [diffuseEnvironmentTexture] - The prefiltered diffuse environment map.
 * @property {Number[]} [diffuseSphericalHarmonics] - Spherical harmonics coefficients to approximate the prefiltered diffuse environment map.
 */

// const GL = WebGLRenderingContext;

// const CUBE_FACE_TARGETS = [
//   GL.TEXTURE_CUBE_MAP_POSITIVE_X,
//   GL.TEXTURE_CUBE_MAP_NEGATIVE_X,
//   GL.TEXTURE_CUBE_MAP_POSITIVE_Y,
//   GL.TEXTURE_CUBE_MAP_NEGATIVE_Y,
//   GL.TEXTURE_CUBE_MAP_POSITIVE_Z,
//   GL.TEXTURE_CUBE_MAP_NEGATIVE_Z,
// ];

/**
 * A class wrapper for the gltf khrLightsImageBasedLight object.
 */
export class KHRLightsImageBasedLight extends NamedGLTFProperty {
  /**
   * Creates an instance of KHRLightsImageBasedScene.
   * @param {khrLightsImageBasedLight} khrLightsImageBasedLight - The properties of the khrLightsImageBasedLight.
   */
  constructor(khrLightsImageBasedLight) {
    super(khrLightsImageBasedLight);

    const { rotation = [0, 0, 0, 1], brightnessFactor = 1, brightnessOffset = 0 } = khrLightsImageBasedLight;
    const { specularEnvironmentTexture, diffuseEnvironmentTexture, diffuseSphericalHarmonics } = khrLightsImageBasedLight;

    /**
     * Quaternion that represents the rotation of the IBL environment. It applies to both the specular and diffuse part.
     * @type {Number[]}
     */
    this.rotation = rotation;

    /**
     * Brightness multiplier for both the specular and diffuse part.
     * @type {Number}
     */
    this.brightnessFactor = brightnessFactor;

    /**
     * Brightness offset for both the specular and diffuse part. Offset is applied after the factor.
     * @type {Number}
     */
    this.brightnessOffset = brightnessOffset;

    /**
     * The texture or the index of the texture for the prefiltered specular environment map.
     * @type {Number|Texture}
     */
    this.specularEnvironmentTexture = specularEnvironmentTexture;

    /**
     * The texture or the index of the texture for the prefiltered diffuse environment map.
     * @type {Number|Texture}
     */
    this.diffuseEnvironmentTexture = diffuseEnvironmentTexture;

    /**
     * Spherical harmonics coefficients to approximate the prefiltered diffuse environment map.
     * @type {Number[]}
     */
    this.diffuseSphericalHarmonics = diffuseSphericalHarmonics;

    Object.defineProperty(this, '$textures', { value: new WeakMap() });
  }

  /**
   * Dereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  dereference(root) {
    this.dereferenceFromCollection('specularEnvironmentTexture', root.textures);
    this.dereferenceFromCollection('diffuseEnvironmentTexture', root.textures);
    super.dereference(root);
  }

  /**
   * Rereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  rereference(root) {
    this.rereferenceFromCollection('specularEnvironmentTexture', root.textures);
    this.rereferenceFromCollection('diffuseEnvironmentTexture', root.textures);
    super.rereference(root);
  }

  // /**
  //  * Creates the specular texture in a WebGL context.
  //  * @param {WebGLRenderingContext} context - The WebGL context.
  //  */
  // createWebGLTexture(context) {
  //   const texture = context.createTexture();
  //   context.activeTexture(GL.TEXTURE0);
  //   context.bindTexture(context.TEXTURE_CUBE_MAP, texture);

  //   for(let mip = 0; mip < this.specularImages.length; mip++) {
  //     for(let i = 0; i < this.specularImages[mip].length; i++) {
  //       const { $data } = this.specularImages[mip][i];
  //       context.texImage2D(CUBE_FACE_TARGETS[i], Number(mip), GL.RGBA, GL.RGBA, GL.UNSIGNED_BYTE, $data);
  //     }
  //   }
  //   this.$textures.set(context, texture);
  // }

  // /**
  //  * Returns the specular texture for the WebGL context. If the texture does not exist for this context it will be created.
  //  * @param {WebGLRenderingContext} context - The WebGL context.
  //  */
  // getWebGLTexture(context) {
  //   return this.$textures.get(context) ||
  //     this.$textures.set(context, this.createWebGLTexture(context)).get(context);
  // }
}

/**
 * KHR_lights_image_based glTF extension
 * @typedef {glTFProperty} khrLightsImageBasedGLTF
 * @property {khrLightsImageBasedLight[]} imageBasedLights - An array of image based lights.
 */

/**
 * A class wrapper for the gltf khrLightsImageBasedGLTF object.
 */
export class KHRLightsImageBasedGLTF extends GLTFProperty {
  /**
   * Creates an instance of KHRLightsImageBasedGLTF.
   * @param {khrLightsImageBasedGLTF} khrLightsImageBasedGLTF - The properties of the KHR_lights_image_based glTF extension.
   */
  constructor(khrLightsImageBasedGLTF) {
    super(khrLightsImageBasedGLTF);

    const { imageBasedLights } = khrLightsImageBasedGLTF;

    /**
     * An array of lights.
     * @type {KHRLightsImageBasedLight}
     */
    this.imageBasedLights = imageBasedLights.map((light) => new KHRLightsImageBasedLight(light));
  }
}

/**
 * EXT_lights_iamge_based scene extension
 * @typedef {glTFProperty} extLightsImageBasedScene
 * @property {Number} imageBasedLight - The id of the light referenced by this scene.
 */

 /**
  * A class wrapper for the gltf extLightsImageBasedScene object.
  */
export class KHRLightsImageBasedScene extends GLTFProperty {
  /**
   * Creates an instance of KHRLightsImageBasedScene.
   * @param {extLightsImageBasedScene} extLightsImageBasedScene - The properties of the KHR_lights_image_based scene extension.
   */
  constructor(extLightsImageBasedScene) {
    super(extLightsImageBasedScene);

    const { imageBasedLight } = extLightsImageBasedScene;

    /**
     * The light or the index of the light referenced by this scene.
     * @type {Number|KHRLightsImageBasedLight}
     */
    this.imageBasedLight = imageBasedLight;
  }

  /**
   * Dereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  dereference(root) {
    this.dereferenceFromCollection('imageBasedLight', root.extensions.KHR_lights_image_based.imageBasedLights);
    this.imageBasedLight.dereference(root);
    super.dereference(root);
  }

  /**
   * Rereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  rereference(root) {
    this.imageBasedLight.rereference(root);
    this.rereferenceFromCollection('imageBasedLight', root.extensions.KHR_lights_image_based.imageBasedLights);
    super.rereference(root);
  }
}

extensions.set('KHR_lights_image_based', {
  schema: {
    WebGLTF: KHRLightsImageBasedGLTF,
    Scene: KHRLightsImageBasedScene,
  }
});
