import { extensions, GLTFProperty, NamedGLTFProperty } from '../webgltf.js';

/**
 * @see https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/EXT_lights_image_based
 */

/**
 * An image-based lighting environment.
 * @typedef {namedGLTFProperty} extLightsImageBasedLight
 * @property {Number[]} [rotation=[0,0,0,1]] - Quaternion that represents the rotation of the IBL environment.
 * @property {Number} [intensity=1] - Brightness multiplier for environment.
 * @property {Number[]} irradianceCoefficients - Declares spherical harmonic coefficients for irradiance up to l=2. This is a 9x3 array.
 * @property {Number[]} specularImages - Declares an array of the first N mips of the prefiltered cubemap. Each mip is, in turn, defined with an array of 6 images, one for each cube face. i.e. this is an Nx6 array.
 * @property {Number} specularImageSize - The dimension (in pixels) of the first specular mip. This is needed to determine, pre-load, the total number of mips needed.
 */

const GL = WebGLRenderingContext;

const CUBE_FACE_TARGETS = [
  GL.TEXTURE_CUBE_MAP_POSITIVE_X,
  GL.TEXTURE_CUBE_MAP_NEGATIVE_X,
  GL.TEXTURE_CUBE_MAP_POSITIVE_Y,
  GL.TEXTURE_CUBE_MAP_NEGATIVE_Y,
  GL.TEXTURE_CUBE_MAP_POSITIVE_Z,
  GL.TEXTURE_CUBE_MAP_NEGATIVE_Z,
];


/**
 * A class wrapper for the gltf extLightsImageBasedLight object.
 */
export class EXTLightsImageBasedLight extends NamedGLTFProperty {
  /**
   * Creates an instance of EXTLightsImageBasedLight.
   * @param {extLightsImageBasedLight} extLightsImageBasedLight - The properties of the extLightsImageBasedLight.
   */
  constructor(extLightsImageBasedLight) {
    super(extLightsImageBasedLight);

    const { rotation = [0, 0, 0, 1], intensity = 1, irradianceCoefficients, specularImages, specularImageSize } = extLightsImageBasedLight;

    /**
     * Quaternion that represents the rotation of the IBL environment.
     * @type {Number[]}
     */
    this.rotation = rotation;

    /**
     * Brightness multiplier for environment.
     * @type {Number}
     */
    this.intensity = intensity;

    /**
     * Declares spherical harmonic coefficients for irradiance up to l=2. This is a 9x3 array.
     * @type {Number[]}
     */
    this.irradianceCoefficients = irradianceCoefficients;

    /**
     * Declares an array of the first N mips of the prefiltered cubemap. Each mip is, in turn, defined with an array of 6 images, one for each cube face. i.e. this is an Nx6 array.
     * @type {Number[]}
     */
    this.specularImages = specularImages;

    /**
     * The dimension (in pixels) of the first specular mip. This is needed to determine, pre-load, the total number of mips needed.
     * @type {Number}
     */
    this.specularImageSize = specularImageSize;

    Object.defineProperty(this, '$textures', { value: new WeakMap() });
  }

  /**
   * Dereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  dereference(root) {
    for(let mip = 0; mip < this.specularImages.length; mip++) {
      for(let i = 0; i < this.specularImages[mip].length; i++) {
        this.specularImages[mip][i] = root.images[this.specularImages[mip][i]];
      }
    }
    this.dereferenceFromCollection('light', root.extensions.EXT_lights_image_based.lights);
    super.dereference(root);
  }

  /**
   * Rereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  rereference(root) {
    for(let mip = 0; mip < this.specularImages.length; mip++) {
      for(let i = 0; i < this.specularImages[mip].length; i++) {
        this.specularImages[mip][i] = root.images.indexOf(this.specularImages[mip][i]);
      }
    }
    this.rereferenceFromCollection('light', root.extensions.EXT_lights_image_based.lights);
    super.rereference(root);
  }

  /**
   * Creates the specular texture in a WebGL context.
   * @param {WebGLRenderingContext} context - The WebGL context.
   */
  createWebGLTexture(context) {
    const texture = context.createTexture();
    context.activeTexture(GL.TEXTURE0);
    context.bindTexture(context.TEXTURE_CUBE_MAP, texture);

    for(let mip = 0; mip < this.specularImages.length; mip++) {
      for(let i = 0; i < this.specularImages[mip].length; i++) {
        const { $data } = this.specularImages[mip][i];
        context.texImage2D(CUBE_FACE_TARGETS[i], Number(mip), GL.RGBA, GL.RGBA, GL.UNSIGNED_BYTE, $data);
      }
    }
    this.$textures.set(context, texture);
  }

  /**
   * Returns the specular texture for the WebGL context. If the texture does not exist for this context it will be created.
   * @param {WebGLRenderingContext} context - The WebGL context.
   */
  getWebGLTexture(context) {
    return this.$textures.get(context) ||
      this.$textures.set(context, this.createWebGLTexture(context)).get(context);
  }

}

/**
 * EXT_lights_image_based glTF extension
 * @typedef {glTFProperty} extLightsImageBasedGLTF
 * @property {extLightsImageBasedLight[]} lights - An array of lights.
 */

/**
 * A class wrapper for the gltf extLightsImageBasedGLTF object.
 */
export class EXTLightsImageBasedGLTF extends GLTFProperty {
  /**
   * Creates an instance of EXTLightsImageBasedGLTF.
   * @param {extLightsImageBasedGLTF} extLightsImageBasedGLTF - The properties of the EXT_lights_image_based glTF extension.
   */
  constructor(extLightsImageBasedGLTF) {
    super(extLightsImageBasedGLTF);

    const { lights } = extLightsImageBasedGLTF;

    /**
     * An array of lights.
     * @type {EXTLightsImageBasedLight}
     */
    this.lights = lights.map((light) => new EXTLightsImageBasedLight(light));
  }
}

/**
 * EXT_lights_iamge_based scene extension
 * @typedef {glTFProperty} extLightsImageBasedScene
 * @property {Number} light - The id of the light referenced by this scene.
 */

 /**
  * A class wrapper for the gltf extLightsImageBasedScene object.
  */
export class EXTLightsImageBasedScene extends GLTFProperty {
  /**
   * Creates an instance of EXTLightsImageBasedScene.
   * @param {extLightsImageBasedScene} extLightsImageBasedScene - The properties of the EXT_lights_image_based scene extension.
   */
  constructor(extLightsImageBasedScene) {
    super(extLightsImageBasedScene);

    const { light } = extLightsImageBasedScene;

    /**
     * The light or the index of the light referenced by this scene.
     * @type {Number|EXTLightsImageBasedLight}
     */
    this.light = light;
  }

  /**
   * Dereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  dereference(root) {
    this.dereferenceFromCollection('light', root.extensions.EXT_lights_image_based.lights);
    this.light.dereference(root);
    super.dereference(root);
  }

  /**
   * Rereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  rereference(root) {
    this.light.rereference(root);
    this.rereferenceFromCollection('light', root.extensions.EXT_lights_image_based.lights);
    super.rereference(root);
  }
}

extensions.set('EXT_lights_image_based', {
  schema: {
    WebGLTF: EXTLightsImageBasedGLTF,
    Scene: EXTLightsImageBasedScene,
  }
});
