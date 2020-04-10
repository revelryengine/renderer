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

    Object.defineProperty(this, '_arrayBuffer', { value: new ArrayBuffer(this.byteLength) });
  }

  /**
   * Dereference uri string from relative.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  dereference(root) {
    if (this.uri && !this.uri.startsWith('data:')) {
      this.uri = new URL(this.uri, root.$uri);
    }
    super.dereference(root);
  }

  /**
   * Rereference uri string to relative string.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  rereference(root) {
    this.rereferenceFromCollection('buffer', root.buffers);
    super.rereference(root);
  }

  /**
   * Fetches the binary data into an array buffer.
   */
  async load(abortCtl) {
    if (this.uri) {
      new Uint8Array(this._arrayBuffer).set(new Uint8Array(await fetch(this.uri, abortCtl).then(res => res.arrayBuffer())));
    }
    await super.load(abortCtl);
    return this._arrayBuffer;
  }

  /**
   * Returns the data loaded into memory for this buffer
   * @returns {ArrayBuffer}
   */
  getArrayBuffer() {
    return this._arrayBuffer;
  }
}

export default Buffer;
