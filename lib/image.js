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
   * @param {WebGLTF} [root=this] - The root WebGLTF object.
   */
  constructor(image, root) {
    super(image, root);

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
   * Dereference glTF index properties.
   */
  dereference() {
    super.dereference('bufferView', 'bufferViews');
  }

  /**
   * Rereference glTF index properties.
   */
  rereference() {
    super.rereference('bufferView', 'bufferViews');
  }

  async load() {
    if (!this.$data) {
      const value = await new Promise((resolve, reject) => {
        const image = new window.Image();
        const uri = this.$root.getRelativeURI(this.uri);
        image.crossOrigin = uri.origin !== window.location.origin ? '' : undefined;
        image.src = uri;
        image.onload = () => resolve(image);
        image.onerror = reject;
      });

      Object.defineProperty(this, '$data', { value });
    }
    return this.$data;
  }
}

export default Image;
