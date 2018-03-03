import { TextureInfo } from './texture-info.js';

/**
 * Reference to a texture.
 * @typedef {textureInfo} normalTextureInfo
 * @property {Number} [scale=1] - The scalar multiplier applied to each normal vector of the normal texture.
 *
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#normaltextureinfo
 */

/**
 * A class wrapper around the glTF normalTextureInfo object.
 */
export class NormalTextureInfo extends TextureInfo {
  /**
   * Creates an instance of NormalTextureInfo.
   * @param {normalTextureInfo} normalTextureInfo - The properties of the normalTextureInfo.
   */
  constructor(normalTextureInfo) {
    super(normalTextureInfo);

    const { scale = 1 } = normalTextureInfo;

    /**
     * The scalar multiplier applied to each normal vector of the normal texture.
     * @type {Number}
     */
    this.scale = scale;
  }
}

export default NormalTextureInfo;
