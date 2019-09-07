import { NamedGLTFProperty } from './named-gltf-property.js';

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
  }

  /**
   * Dereference uri string from relative.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  dereference(root) {
    if (this.uri && !this.uri.startsWith('data:')) {
      this.uri = new URL(this.uri, root.$uri);
    }
  }

  /**
   * Rereference uri string to relative string.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  rereference() {
    super.rereference('buffer', root.buffers);
  }

  /**
   * Fetches the binary data into an array buffer.
   */
  async load() {
    if (!this.$data) {
      const value = await fetch(this.uri).then(res => res.arrayBuffer());
      Object.defineProperty(this, '$data', { value });
    }
    return this.$data;
  }
}

export default Buffer;
