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
  /**
   * Creates an instance of Indices.
   * @param {indices} indices - The properties of the indices.
   */
  constructor(indices) {
    super(indices);

    const { bufferView, byteOffest = 0, componentType } = indices;

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
    this.byteOffest = byteOffest;

    /**
     * The indices data type.
     * @type {Number}
     */
    this.componentType = componentType;
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
}

export default Indices;
