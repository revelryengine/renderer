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
   * @param {WebGLTF} [root=this] - The root WebGLTF object.
   */
  constructor(textureInfo, root) {
    super(textureInfo, root);

    const { index, texCoord = 0 } = textureInfo;

    /**
     * The Texture.
     * @type {Texture}
     */
    this.texture = root.textures[index];

    /**
     * The set index of texture's TEXCOORD attribute used for texture coordinate mapping.
     * @type {Number}
     */
    this.texCoord = texCoord;
  }

  /**
   * Re-references any glTF index properties.
   */
  toJSON() {
    const { texture, ...rest } = this;
    return {
      ...rest,
      index: this.$root.textures.indexOf(this.texture),
    };
  }
}

export default TextureInfo;
