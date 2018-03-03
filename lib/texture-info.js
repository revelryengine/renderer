import { GLTFProperty    } from './gltf-property.js';

/**
 * Reference to a texture.
 * @typedef {glTFProperty} textureInfo
 * @property {Number} index - The index of the texture.
 * @property {Number} [texCoord=0] - The set index of texture's TEXCOORD attribute used for texture coordinate mapping.
 *
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#textureinfo
 */

/**
 * A class wrapper around the glTF textureInfo object.
 */
export class TextureInfo extends GLTFProperty {
  /**
   * Creates an instance of TextureInfo.
   * @param {textureInfo} textureInfo - The properties of the textureInfo.
   */
  constructor(textureInfo) {
    super(textureInfo);

    const { index, texCoord = 0 } = textureInfo;

    /**
     * The index of the Texture.
     * @type {Number}
     */
    this.index = index;

    /**
     * The set index of texture's TEXCOORD attribute used for texture coordinate mapping.
     * @type {Number}
     */
    this.texCoord = texCoord;
  }

  /**
   * Dereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  dereference(root) {
    /**
     * The Texture.
     * @type {Texture}
     */
    this.texture = root.textures[this.index];
    delete this.index;
  }

  /**
   * Rereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  rereference(root) {
    this.index = root.textures.indexOf(this.texture);
    delete this.texture;
  }
}

export default TextureInfo;
