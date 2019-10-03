import { DracoDecoderModule } from '../../vendor/draco-decoder.js';

import { GLTFProperty, extensions } from '../webgltf.js';

const draco = new DracoDecoderModule();

/**
 * @see https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_draco_mesh_compression
 */

/**
 * KHR_draco_mesh_compression primitive extension
 * @typedef {glTFProperty} khrDracoMeshCompressionPrimitive
 * @property {Number} bufferView - The index of the bufferView.
 * @property {Object} attributes - A dictionary object, where each key corresponds to an attribute and its unique
 * attribute id stored in the compressed geometry.
 */

const DracoArrayGetters =new Map([
  [Float32Array, { type: 'DracoFloat32Array', method: 'GetAttributeFloatForAllPoints'  }],
  [Int8Array,    { type: 'DracoInt8Array',    method: 'GetAttributeInt8ForAllPoints'   }],
  [Int16Array,   { type: 'DracoInt16Array',   method: 'GetAttributeInt16ForAllPoints'  }],
  [Int32Array,   { type: 'DracoInt32Array',   method: 'GetAttributeInt32ForAllPoints'  }],
  [Uint8Array,   { type: 'DracoUInt8Array',   method: 'GetAttributeUInt8ForAllPoints' }],
  [Uint16Array,  { type: 'DracoUInt16Array',  method: 'GetAttributeUInt16ForAllPoints' }],
  [Uint32Array,  { type: 'DracoUInt32Array',  method: 'GetAttributeUInt32ForAllPoints' }],
]);

 /**
  * A class wrapper for the gltf khrDracoMeshCompressionPrimitive object.
  */
export class KHRDracoMeshCompressionPrimitive extends GLTFProperty {
  /**
   * Creates an instance of KHRDracoMeshCompressionPrimitive.
   * @param {khrDracoMeshCompressionPrimitive} khrDracoMeshCompressionPrimitive - The properties of the KHR_lights_punctual primitive extension.
   * @param {Object} primitive - The parent primitive object this extension belongs to.
   */
  constructor(khrDracoMeshCompressionPrimitive, primitive) {
    super(khrDracoMeshCompressionPrimitive);

    const { bufferView, attributes } = khrDracoMeshCompressionPrimitive;

    /**
     * The BufferView or the index of the BufferView.
     * @type {Number|BufferView}
     */
    this.bufferView = bufferView;

    /**
     * A dictionary object, where each key corresponds to an attribute and its unique
     * attribute or attributes id stored in the compressed geometry.
     * @type {Object.<String, Number>}
     */
    this.attributes = attributes;

    Object.defineProperty(this, '_primitive', { value: primitive });
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

  /**
   * @todo move this into a web worker and add wasm support
   * Used three.js as a reference. @see https://github.com/mrdoob/three.js/blob/dev/examples/js/loaders/DRACOLoader.js
   */
  async load() {
    const decoder = new draco.Decoder();
    const decoderBuffer = new draco.DecoderBuffer();

    const { buffer, byteOffset = 0, byteLength } = this.bufferView;

    await buffer.loadOnce();

    const arrayBuffer = buffer.getArrayBuffer();

    decoderBuffer.Init(new Int8Array(arrayBuffer, byteOffset, byteLength), byteLength);

    const geometryType = decoder.GetEncodedGeometryType(decoderBuffer);

    let dracoGeometry, decodingStatus;
    if (geometryType === draco.TRIANGULAR_MESH) {
			dracoGeometry = new draco.Mesh();
			decodingStatus = decoder.DecodeBufferToMesh(decoderBuffer, dracoGeometry);
		} else if (geometryType === draco.POINT_CLOUD) {
			dracoGeometry = new draco.PointCloud();
			decodingStatus = decoder.DecodeBufferToPointCloud(decoderBuffer, dracoGeometry);
		} else {
			throw new Error('Unexpected geometry type.');
    }
    if (!decodingStatus.ok() || dracoGeometry.ptr === 0) {
			throw new Error('Decoding failed: ' + decodingStatus.error_msg());
		}

    const numPoints = dracoGeometry.num_points();

    for (const [name, attributeId] of Object.entries(this.attributes)) {

      const accessor = this._primitive.attributes[name];
      await accessor.loadOnce();

      const accessorArray = accessor.getTypedArray();

      const { type, method } = DracoArrayGetters.get(accessorArray.constructor);
      const dracoArray = new draco[type]();

      const attribute = decoder.GetAttributeByUniqueId(dracoGeometry, attributeId);
      const numComponents = attribute.num_components();
      const numValues = numPoints * numComponents;

      decoder[method](dracoGeometry, attribute, dracoArray);

      for (let i = 0; i < numValues; i++) {
        accessorArray[i] = dracoArray.GetValue(i);
      }

      draco.destroy(dracoArray);
    }

		if (geometryType === draco.TRIANGULAR_MESH) {
      const accessor = this._primitive.indices;

      await accessor.loadOnce();

      const numFaces = dracoGeometry.num_faces();
      const index = accessor.getTypedArray();
      const indexArray = new draco.DracoInt32Array();

			for (let i = 0; i < numFaces; i++) {
        decoder.GetFaceFromMesh(dracoGeometry, i, indexArray);

				for (let j = 0; j < 3; j++) {
          index[i * 3 + j] = indexArray.GetValue(j);
				}
      }

      draco.destroy(indexArray);
		}

		draco.destroy(dracoGeometry);
  }
}

extensions.set('KHR_draco_mesh_compression', {
  schema: {
    Primitive: KHRDracoMeshCompressionPrimitive,
  },
  async load() {
    /**
     * @todo move draco decoder to web worker and set up communication channel
     */
  }
});
