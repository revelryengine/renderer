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

const GL = WebGLRenderingContext;

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
    super.dereference('buffer', root.buffers);
  }

  /**
   * Rereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  rereference() {
    super.rereference('buffer', root.buffers);
  }

  /**
   * Creates a buffer in a WebGL context.
   * @param {WebGLRenderingContext} context - The WebGL context.
   * @param {Number} inferredTarget - The target inferred from the accessor. If the bufferView defines a target it will be used instead.
   *
   * @see https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#buffers-and-buffer-views
   */
  createBuffer(context, inferredTarget) {
    const { buffer: { $data }, byteOffset = 0, byteLength, target = inferredTarget } = this;

    const buffer = context.createBuffer();
    context.bindBuffer(target, buffer);
    context.bufferData(target, $data.slice(byteOffset, byteOffset + byteLength), GL.STATIC_DRAW);
    return buffer;
  }
}

export default BufferView;
