import { NamedGLTFProperty } from './gltf-property.js';
import { HDRImage          } from '../web_modules/hdrpng.js';

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
    if (this.uri) this.uri = new URL(this.uri, root.$uri);
    this.dereferenceFromCollection('bufferView', root.bufferViews);
    super.dereference(root);
  }

  /**
   * Rereference glTF index properties and rereference uri string to relative string.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  rereference(root) {
    this.rereferenceFromCollection('bufferView', root.bufferViews);
    super.rereference(root);
  }

  async load() {
    if (!this._data) {
      const ImageClass = this.mimeType === 'image/vnd.radiance' ? HDRImage : window.Image;
      Object.defineProperty(this, '_data', { value: new ImageClass() });

      if (this.uri) {
        this._data.crossOrigin = this.uri.origin !== window.location.origin ? '' : undefined;
        this._data.src = this.uri.href;
      } else if (this.bufferView) {
        const { buffer, byteOffset, byteLength } = this.bufferView;

        buffer.loadOnce().then(() => {
          const arrayBuffer = buffer.getArrayBuffer();

          const blob = new Blob([new Uint8Array(arrayBuffer, byteOffset, byteLength)], { type: this.mimeType });
          this._data.src = URL.createObjectURL(blob);
        });
      }

      await new Promise((resolve, reject) => {
        this._data.onload = resolve;
        this._data.onerror = () => reject('Failed to load image');
      });
    }

    await super.load();
    return this._data;
  }

  getImageData() {
    return this._data;
  }
}

export default Image;
