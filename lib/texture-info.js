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

  static referenceFields = [
    { name: 'index', type: 'collection', collection: 'textures', alias: 'texture' },
  ];

  /**
   * Set this to true indicate that texture uses sRGB transfer function 
   * @see https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#metallic-roughness-material
   */ 
  set sRGB(v) {
    this.texture.sRGB = v;
  }

  /**
   * Creates the texture in a WebGL context.
   * @param {WebGLRenderingContext} context - The WebGL context.
   */
  createWebGLTexture(context) {
    return this.texture.createWebGLTexture(context);
  }

  /**
   * Returns the texture for the WebGL context. If the texture does not exist for this context it will be created.
   * @param {WebGLRenderingContext} context - The WebGL context.
   */
  getWebGLTexture(context) {
    return this.texture.getWebGLTexture(context);
  }
}

export default TextureInfo;
