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
   * @param {WebGLTF} [root=this] - The root WebGLTF object.
   */
  constructor(indices, root) {
    super(indices, root);

    const { bufferView, byteOffest = 0, componentType } = indices;

    /**
     * The BufferView with sparse indices. Referenced bufferView can't have ARRAY_BUFFER or ELEMENT_ARRAY_BUFFER target.
     * @type {BufferView}
     */
    this.bufferView = this.bufferViews[bufferView];

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
   * Re-references any glTF index properties.
   */
  toJSON() {
    return {
      ...this,
      bufferView: this.$root.bufferViews.indexOf(this.bufferView),
    };
  }
}

export default Indices;
