import { NamedGLTFProperty } from './gltf-property.js';

// const _ArrayBuffer = typeof SharedArrayBuffer !== 'undefined' ? SharedArrayBuffer : ArrayBuffer;

/**
 * A buffer points to binary geometry, animation, or skins.
 * @typedef {namedGLTFProperty} buffer
 * @property {String} [uri] - The uri of the buffer.
 * @property {Number} byteLength - The length of the buffer in bytes.
 *
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#buffer
 */

/**
 * A class wrapper around the glTF buffer object.
 */
export class Buffer extends NamedGLTFProperty {
  #arrayBuffer;

  /**
   * Creates an instance of Buffer.
   * @param {buffer} buffer - The properties of the buffer.
   */
  constructor(buffer) {
    super(buffer);

    const { uri, byteLength } = buffer;

    /**
     * The uri of the buffer. Relative paths are relative to the .gltf file. Instead of referencing an external
     * file, the uri can also be a data-uri.
     * @type {string}
     */
    this.uri = uri;

    /**
     * The length of the buffer in bytes.
     * @type {number}
     */
    this.byteLength = byteLength;

    this.#arrayBuffer = new ArrayBuffer(this.byteLength);
  }

  static referenceFields = [
    { name: 'uri', type: 'uri' },
  ];

  /**
   * Fetches the binary data into an array buffer.
   */
  async load(abortCtl) {
    if (this.uri) {
      new Uint8Array(this.#arrayBuffer).set(new Uint8Array(await fetch(this.uri, abortCtl).then(res => res.arrayBuffer())));
    }
    await super.load(abortCtl);
    return this.#arrayBuffer;
  }

  /**
   * Returns the data loaded into memory for this buffer
   * @returns {ArrayBuffer}
   */
  getArrayBuffer() {
    return this.#arrayBuffer;
  }
}

export default Buffer;
