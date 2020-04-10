import { GLTFProperty } from './gltf-property.js';

/**
 * Array of size {@link accessor.sparse.count} times number of components storing the
 * displaced accessor attributes pointed by {@link accessor.sparse.indices}.
 * @typedef {glTFProperty} values
 * @property {Number} bufferView The index of the bufferView with sparse values. Referenced bufferView can't have
 * ARRAY_BUFFER or ELEMENT_ARRAY_BUFFER target.
 * @property {Number} [byteOffset=0] The offset relative to the start of the bufferView in bytes. Must be aligned.
 *
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#values
*/

/**
 * A class wrapper around the glTF values object.
 */
export class Values extends GLTFProperty {
  /**
   * Creates an instance of Values.
   * @param {values} values - The properties of the values.
   */
  constructor(values) {
    super(values);

    const { bufferView, byteOffset = 0 } = values;

    /**
     * The BufferView or the index of the BufferView with sparse value. Referenced bufferView can't have ARRAY_BUFFER
     * or ELEMENT_ARRAY_BUFFER target.
     * @type {Number|BufferView}
     */
    this.bufferView = bufferView;

    /**
     * The offset relative to the start of the bufferView in bytes. Must be aligned.
     * @type {Number}
     */
    this.byteOffset = byteOffset;
  }

  /**
   * Dereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  dereference(root) {
    this.dereferenceFromCollection('bufferView', root.bufferViews);
    super.dereference(root);
  }

  /**
   * Rereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  rereference(root) {
    this.rereferenceFromCollection('bufferView', root.bufferViews);
    super.rereference(root);
  }

  async load(abortCtl) {
    const { bufferView } = this;

    await bufferView.buffer.loadOnce(abortCtl);
    Object.defineProperty(this, '_arrayBuffer', { value: bufferView.buffer.getArrayBuffer() });

    await super.load(abortCtl);
  }

    /**
   * Returns the data loaded into memory for this accessor.
   * @returns {ArrayBuffer}
   */
  getArrayBuffer() {
    return this._arrayBuffer;
  }
}

export default Values;
