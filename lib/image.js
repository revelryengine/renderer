import { NamedGLTFProperty } from './named-gltf-property.js';

/**
 * Image data used to create a texture. Image can be referenced by URI or {@link bufferView} index. `mimeType` is
 * required in the latter case.
 * @typedef {namedGLTFProperty} image
 * @property {String} [uri] - The uri of the image.
 * @property {String} [mimeType] - The image's MIME type.
 * @property {Number} [bufferView] - The index of the bufferView that contains the image. Use this instead of the
 * image's uri property.
 *
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#image
 */

/**
 * A class wrapper around the glTF image object.
 */
export class Image extends NamedGLTFProperty {
  /**
   * Creates an instance of Image.
   * @param {image} image - The properties of the image.
   */
  constructor(image) {
    super(image);

    const { uri, mimeType, bufferView } = image;

    /**
     * The uri of the image.
     * @type {String}
     */
    this.uri = uri;
    /**
     * The image's MIME type.
     * @type {String}
     */
    this.mimeType = mimeType;
    /**
     * The BufferView or the index of the BufferView that contains the image. Use this instead of the image's uri property.
     * @type {Nuber|BufferView}
     */
    this.bufferView = bufferView;
  }

  /**
   * Dereference glTF index properties and dereference uri string from relative.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  dereference(root) {
    this.uri = new URL(this.uri, root.$uri);
    super.dereference('bufferView', root.bufferViews);
  }

  /**
   * Rereference glTF index properties and rereference uri string to relative string.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  rereference(root) {
    super.rereference('bufferView', root.bufferViews);
  }

  async load() {
    if (!this.$data) {
      const value = await new Promise((resolve, reject) => {
        const image = new window.Image();
        image.crossOrigin = this.uri.origin !== window.location.origin ? '' : undefined;
        image.src = this.uri;
        image.onload = () => resolve(image);
        image.onerror = reject;
      });

      Object.defineProperty(this, '$data', { value });
    }
    return this.$data;
  }
}

export default Image;
