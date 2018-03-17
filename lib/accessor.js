import { NamedGLTFProperty } from './named-gltf-property.js';

/**
 * A typed view into a bufferView. A bufferView contains raw binary data.
 * An accessor provides a typed view into a bufferView or a subset of a bufferView similar
 * to how WebGL's vertexAttribPointer() defines an attribute in a buffer.
 * @typedef {namedGLTFProperty} accessor
 * @property {Number} [bufferView] - The index of the bufferView.
 * @property {Number} [byteOffset=0] - The offset relative to the start of the bufferView in bytes.
 * @property {Number} componentType - The datatype of components in the attribute.
 * @property {Boolean} [normalized=false] - Specifies whether integer data values should be normalized.
 * @property {Number} count - The number of attributes referenced by this accessor.
 * @property {String} type - Specifies if the attribute is a scalar, vector, or matrix.
 * @property {Number} [max] - Maximum value of each component in this attribute.
 * @property {Number} [min] - Minimum value of each component in this attribute.
 * @property {sparse} [sparse] - Sparse storage of attributes that deviate from their initialization value.
 *
 * @see https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#accessors
 * @see https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#accessor
 */

const GL = WebGLRenderingContext;
const NUMBER_OF_COMPONENTS = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
};

const NUMBER_OF_BYTES = {
  [GL.BYTE]: 1,
  [GL.UNSIGNED_BYTE]: 1,
  [GL.SHORT]: 2,
  [GL.UNSIGNED_SHORT]: 2,
  [GL.UNSIGNED_INT]: 4,
  [GL.FLOAT]: 4,
};

const TYPEDARRAYS = {
  [GL.BYTE]: Int8Array,
  [GL.UNSIGNED_BYTE]: Uint8Array,
  [GL.SHORT]: Int16Array,
  [GL.UNSIGNED_SHORT]: Uint16Array,
  [GL.UNSIGNED_INT]: Uint32Array,
  [GL.FLOAT]: Float32Array,
};

/**
 * A class wrapper around the glTF accessor object.
 */
export class Accessor extends NamedGLTFProperty {
  /**
   * Creates an instance of Accessor.
   * @param {accessor} accessor - The properties of the accessor.
   */
  constructor(accessor) {
    super(accessor);
    const {
      bufferView, byteOffset = 0, componentType, normalized = false,
      count, type, max, min, sparse,
    } = accessor;

    /**
     * The BufferView or the index of the BufferView. When not defined, accessor must be initialized with zeros;
     * sparse property or extensions could override zeros with actual values.
     * @type {Number|BufferView}
     */
    this.bufferView = bufferView;

    /**
     * The offset relative to the start of the bufferView in bytes.
     * This must be a multiple of the size of the component datatype.
     * @type {Number}
     */
    this.byteOffset = byteOffset;

    /**
     * The datatype of components in the attribute. All valid values correspond to WebGL enums.
     * The corresponding typed arrays are Int8Array, Uint8Array, Int16Array, Uint16Array, Uint32Array, and Float32Array,
     * respectively. 5125 (UNSIGNED_INT) is only allowed when the accessor contains indices, i.e., the accessor is only
     * referenced by primitive.indices.
     *
     * Allowed Values:
     * * 5120 BYTE
     * * 5121 UNSIGNED_BYTE
     * * 5122 SHORT
     * * 5123 UNSIGNED_SHORT
     * * 5125 UNSIGNED_INT
     * * 5126 FLOAT
     * @type {Number}
     */
    this.componentType = componentType;

    /**
     * Specifies whether integer data values should be normalized (true) to [0, 1] (for unsigned types) or [-1, 1]
     * (for signed types), or converted directly (false) when they are accessed. This property is defined only for
     * accessors that contain vertex attributes or animation output data.
     * @type {Boolean}
     */
    this.normalized = normalized;

    /**
     * The number of attributes referenced by this accessor, not to be confused with the number of bytes or
     * number of components.
     * @type {Number}
     */
    this.count = count;

    /**
     * Specifies if the attribute is a scalar, vector, or matrix.
     *
     * Allowed values:
     * * "SCALAR"
     * * "VEC2"
     * * "VEC3"
     * * "VEC4"
     * * "MAT2"
     * * "MAT3"
     * * "MAT4"
     * @type {String}
     */
    this.type = type;

    /**
     * Maximum value of each component in this attribute. Array elements must be treated as having the same data
     * type as accessor's {@link componentType}. Both min and max arrays have the same length. The length is
     * determined by the value of the type property; it can be 1, 2, 3, 4, 9, or 16.
     *
     * {@link normalized} property has no effect on array values: they always correspond to the actual values
     * stored in the buffer. When accessor is sparse, this property must contain max values of accessor data with
     * sparse substitution applied.
     * @type {Number}
     */
    this.max = max;

    /**
     * Minimum value of each component in this attribute. Array elements must be treated as having the same data
     * type as accessor's {@link componentType}. Both min and max arrays have the same length. The length is
     * determined by the value of the type property; it can be 1, 2, 3, 4, 9, or 16.
     *
     * {@link normalized} property has no effect on array values: they always correspond to the actual values
     * stored in the buffer. When accessor is sparse, this property must contain min values of accessor data with
     * sparse substitution applied.
     * @type {Number}
     */
    this.min = min;

    /**
     * Sparse storage of attributes that deviate from their initialization value.
     * @type {sparse}
     */
    this.sparse = sparse;
  }

  /**
   * Dereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  dereference(root) {
    super.dereference('bufferView', root.bufferViews);
  }

  /**
   * Rereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  rereference(root) {
    super.rereference('bufferView', root.bufferViews);
  }

  /**
   * Returns the typed ArrayBuffer for the componentType. (Int8Array, Uint8Array, Int16Array, Uint16Array, Uint32Array,
   * or Float32Array)
   * @see https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#accessors
   * @returns {ArrayBuffer}
   */
  get TypedArray() {
    return TYPEDARRAYS[this.componentType];
  }

  /**
   * Returns the number of bytes for the componentType. (1, 2, or 4)
   * @see https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#accessor
   * @returns {Number}
   */
  get numberOfBytes() {
    return NUMBER_OF_BYTES[this.componentType];
  }

  /**
   * Returns the number of components for the type. (1, 2, 3, 4, 9 or 16)
   * @see https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#accessor
   * @returns {Number}
   */
  get numberOfComponents() {
    return NUMBER_OF_COMPONENTS[this.type];
  }

  /**
   * Creates a typed ArrayBuffer from the accessor.
   * @param {Number} [offset=0] - The element offset to create the type ArrayBuffer for
   * @returns {Int8Array|Uint8Array|Int16Array|Uint16Array|Uint32Array|Float32Array}
   */
  createTypedView(offset = 0, count = this.count) {
    const { bufferView, byteOffset, numberOfComponents, componentType } = this;
    const { buffer } = bufferView;
    const start = (offset * this.numberOfBytes) + byteOffset + bufferView.byteOffset;
    return new TYPEDARRAYS[componentType](buffer.$data, start, count * numberOfComponents);
  }
}

export default Accessor;
