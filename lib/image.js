import { NamedGLTFProperty } from './gltf-property.js';
import HDRImage              from '../vendor/hdrpng.js';

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
  #imageData;
  #pending;

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

    // this.#imageData = new (Image.mimeClasses[this.mimeType] || window.Image)();
    // this.#imageData.unloaded = true;
  }

  static referenceFields = [
    { name: 'bufferView', type: 'collection', collection: 'bufferViews' },
    { name: 'uri',        type: 'uri' },
  ];

  async loadBufferAsUint8Array(abortCtl) {
    const { buffer, byteOffset, byteLength } = this.bufferView;
    await buffer.loadOnce(abortCtl);
    return new Uint8Array(buffer.getArrayBuffer(), byteOffset, byteLength);
  }

  async loadBufferAsBlobURL(abortCtl) {
    const uint8Array = await this.loadBufferAsUint8Array(abortCtl)
    const blob = new Blob([uint8Array], { type: this.mimeType });
    return URL.createObjectURL(blob);
  }

  async load(abortCtl) {
    if(this.#pending) return this.#pending;

    switch(this.mimeType) {
      case 'image/png':
      case 'image/jpeg':
      case 'image/vnd.radiance':
      case undefined: // If undefined presumed to be standard browser supported image type 
        this.#pending = (async () => {
          const imageData = new (this.mimeType === 'image/vnd.radiance' ? HDRImage : window.Image)();
          if (this.uri) {
            imageData.crossOrigin = this.uri.origin !== window.location.origin ? '' : undefined;
            imageData.src = this.uri.href;
          } else if (this.bufferView) {
            imageData.src = await this.loadBufferAsBlobURL(abortCtl);
          }
          
          this.#imageData = await new Promise((resolve, reject) => {
            imageData.onload = () => resolve(imageData);
            imageData.onerror = () => reject(`Failed to load image: ${imageData.src}`);
          });
        })();   
        break;
      default: //store the data as a buffer
        this.#pending = (async () => {
          if(this.uri) {
            this.#imageData = new Uint8Array(await fetch(this.uri).then(response => response.arrayBuffer()));
          } else {
            this.#imageData = await this.loadBufferAsUint8Array();
          }
          return this.#imageData;
        })();        
    }
    await super.load(abortCtl);
    return this.#pending;
  }

  getImageData() {
    return this.#imageData;
  }
}

export default Image;
