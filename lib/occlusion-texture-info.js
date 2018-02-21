import { TextureInfo } from './texture-info.js';

/**
 * Reference to a texture.
 * @typedef {textureInfo} occlusionTextureInfo
 * @property {Number} [strength=1] - A scalar multiplier controlling the amount of occlusion applied.
 *
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#occlusiontextureinfo
 */

/**
 * A class wrapper around the glTF occlusionTextureInfo object.
 */
export class OcclusionTextureInfo extends TextureInfo {
  /**
   * Creates an instance of OcclusionTextureInfo.
   * @param {occlusionTextureInfo} occlusionTextureInfo - The properties of the occlusionTextureInfo.
   * @param {WebGLTF} [root=this] - The root WebGLTF object.
   */
  constructor(occlusionTextureInfo, root) {
    super(occlusionTextureInfo, root);

    const { strength = 1 } = occlusionTextureInfo;

    /**
     * A scalar multiplier controlling the amount of occlusion applied.
     * @type {Number}
     */
    this.strength = strength;
  }
}

export default OcclusionTextureInfo;
