import { GLTFProperty } from './gltf-property.js';

/**
 * Indices of those attributes that deviate from their initialization value.
 * @typedef {glTFProperty} indices
 * @property {Number} bufferView - The index of the bufferView with sparse indices. Referenced bufferView can't have
 * ARRAY_BUFFER or ELEMENT_ARRAY_BUFFER target.
 * @property {Number} [byteOffset=0] - The offset relative to the start of the bufferView in bytes. Must be aligned.
 * @property {Number} componentType - The indices data type.
 *
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#indices
 */

/**
 * A class wrapper around the glTF indices object.
 */
export class Indices extends GLTFProperty {
  #arrayBuffer;

  /**
   * Creates an instance of Indices.
   * @param {indices} indices - The properties of the indices.
   */
  constructor(indices) {
    super(indices);

    const { bufferView, byteOffset = 0, componentType } = indices;

    /**
     * The BufferView or the index of the BufferView with sparse indices. Referenced bufferView can't have ARRAY_BUFFER
     * or ELEMENT_ARRAY_BUFFER target.
     * @type {Number|BufferView}
     */
    this.bufferView = bufferView;

    /**
     * The offset relative to the start of the bufferView in bytes. Must be aligned.
     * @type {Number}
     */
    this.byteOffset = byteOffset;

    /**
     * The indices data type.  Valid values correspond to WebGL enums: `5121` (UNSIGNED_BYTE), `5123` (UNSIGNED_SHORT), `5125` (UNSIGNED_INT).
     * @type {Number}
     */
    this.componentType = componentType;
  }
  
  static referenceFields = [
    { name: 'bufferView', type: 'collection', collection: 'bufferViews' },
  ];

  async load(abortCtl) {
    const { bufferView } = this;

    await bufferView.buffer.loadOnce(abortCtl);
    this.#arrayBuffer = bufferView.buffer.getArrayBuffer();

    await super.load(abortCtl);
  }

  /**
   * Returns the data loaded into memory for this accessor.
   * @returns {ArrayBuffer}
   */
  getArrayBuffer() {
    return this.#arrayBuffer;
  }
}

export default Indices;
