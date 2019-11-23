import { extensions   } from '../extensions.js';
import { GLTFProperty } from '../gltf-property.js';

/**
 * glTF extension to specify textures using the KTX2 images with Basis Universal supercompression.
 * @see https://github.com/KhronosGroup/glTF/tree/khr_ktx2_ibl/extensions/2.0/Khronos/KHR_texture_basisu
 */


/**
 * KHR_texture_basisu texture extension
 * @typedef {glTFProperty} khrTextureBasisuTexture
 * @property {Number} source - The index of the images node which points to a KTX2 image with Basis Universal supercompression.
 */

 /**
  * A class wrapper for the image khrTextureBasisuTexture object.
  */
export class KHRTextureBasisuTexture extends GLTFProperty {
  /**
   * Creates an instance of KHRTextureBasisuTexture.
   * @param {khrTextureBasisuTexture} khrTextureBasisuTexture - The properties of the KHR_texture_basisu texture extension.
   */
  constructor(khrTextureBasisuTexture) {
    super(khrTextureBasisuTexture);

    const { source } = khrTextureBasisuTexture;

    /**
     * The images node or the index of the images node which points to a KTX2 image with Basis Universal supercompression.
     * @type {Number|Image}
     */
    this.source = source;
  }

  /**
   * Dereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  dereference(root) {
    this.dereferenceFromCollection('source', root.images);
    super.dereference(root);
  }

  /**
   * Rereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  rereference(root) {
    this.rereferenceFromCollection('source', root.images);
    super.rereference(root);
  }
}

extensions.set('KHR_texture_basisu', {
  schema: {
    Texture: KHRTextureBasisuTexture,
  },
});
