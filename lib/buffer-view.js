import { NamedGLTFProperty } from './named-gltf-property.js';

/**
 * A view into a buffer generally representing a subset of the buffer.
 * @typedef {namedGLTFProperty} bufferView
 * @property {Number} buffer - The index of the buffer.
 * @property {Number} [byteOffset = 0] - The offset into the buffer in bytes.
 * @property {Number} byteLength - The length of the bufferView in bytes.
 * @property {Number} [byteStride] - The stride, in bytes.
 * @property {Number} [target] - The target that the GPU buffer should be bound to.
 *
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#bufferview
 */

/**
 * A class wrapper around the glTF buffer object.
 */
export class BufferView extends NamedGLTFProperty {
  /**
   * Creates an instance of BufferView.
   * @param {bufferView} bufferView - The properties of the bufferView.
   */
  constructor(bufferView) {
    super(bufferView);

    const { buffer, byteOffset, byteLength, byteStride, target } = bufferView;

    /**
     * The Buffer or the index of the Buffer.
     * @type {Number|Buffer}
     */
    this.buffer = buffer;

    /**
     * The offset into the buffer in bytes.
     * @type {Number}
     */
    this.byteOffset = byteOffset;

    /**
     * The length of the bufferView in bytes.
     * @type {Number}
     */
    this.byteLength = byteLength;

    /**
     * The stride, in bytes, between vertex attributes. When this is not defined, data is tightly packed.
     * When two or more accessors use the same bufferView, this field must be defined.
     * @type {Number}
     */
    this.byteStride = byteStride;

    /**
     * The target that the GPU buffer should be bound to.
     * Allowed Values:
     * * 34962 ARRAY_BUFFER
     * * 34963 ELEMENT_ARRAY_BUFFER
     * @type {Number}
     */
    this.target = target;
  }

  /**
   * Dereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  dereference(root) {
    this.dereferenceFromCollection('buffer', root.buffers);
    super.dereference(root);
  }

  /**
   * Rereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  rereference(root) {
    this.rereferenceFromCollection('buffer', root.buffers);
    super.rereference(root);
  }
}

export default BufferView;
