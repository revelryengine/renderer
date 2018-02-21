import { GLTFProperty } from './gltf-property.js';

/**
 * Array of size {@link accessor.sparse.count} times number of components storing the
 * displaced accessor attributes pointed by {@link accessor.sparse.indices}.
 * @typedef {glTFProperty} values
 * @property {Number} bufferView The index of the bufferView with sparse indices. Referenced bufferView can't have
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
   * @param {WebGLTF} [root=this] - The root WebGLTF object.
   */
  constructor(values, root) {
    super(values, root);

    const { bufferView, byteOffest = 0 } = values;

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

export default Values;
