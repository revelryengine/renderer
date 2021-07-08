import { extensions   } from '../extensions.js';
import { GLTFProperty } from '../gltf-property.js';

/**
 * @see https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_draco_mesh_compression
 * Used three.js implementation as a reference. @see https://github.com/mrdoob/three.js/blob/dev/examples/js/loaders/DRACOLoader.js
 * @todo figure out how to use SharedArrayBuffer for bufferView if supported. Can't use it in combination with image blob for glb binary.
 */

const WORKERS = 4;
const DRACO_DECODER_URL = new URL('../../vendor/draco_decoder.js', import.meta.url).toString();

const workerPool = [];

/**
 * This function is not to be called directly. The function is converted to a string and loaded as a Web Worker.
 */
function worker() {
  /* global DracoDecoderModule */

  const DracoArrayGetters = new Map([
    [Float32Array, { dracoType: 'DracoFloat32Array', method: 'GetAttributeFloatForAllPoints'  }],
    [Int8Array,    { dracoType: 'DracoInt8Array',    method: 'GetAttributeInt8ForAllPoints'   }],
    [Int16Array,   { dracoType: 'DracoInt16Array',   method: 'GetAttributeInt16ForAllPoints'  }],
    [Int32Array,   { dracoType: 'DracoInt32Array',   method: 'GetAttributeInt32ForAllPoints'  }],
    [Uint8Array,   { dracoType: 'DracoUInt8Array',   method: 'GetAttributeUInt8ForAllPoints'  }],
    [Uint16Array,  { dracoType: 'DracoUInt16Array',  method: 'GetAttributeUInt16ForAllPoints' }],
    [Uint32Array,  { dracoType: 'DracoUInt32Array',  method: 'GetAttributeUInt32ForAllPoints' }],
  ]);

  const dracoPromise = new Promise((resolve) => {
    DracoDecoderModule({ onModuleLoaded: (draco) => resolve({ draco }) });
  });

  self.onmessage = async (message) => {
    const { type, taskId } = message.data;
    if(type === 'decode') {
      try {
        const { arrayBuffer, byteOffset, byteLength, attributes, indices } = message.data;
        const { draco } = await dracoPromise;

        const decoder = new draco.Decoder();
        const decoderBuffer = new draco.DecoderBuffer();

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
          throw new Error(`Unexpected geometry type. ${geometryType}`);
        }
        if (!decodingStatus.ok() || dracoGeometry.ptr === 0) {
          throw new Error('Decoding failed: ' + decodingStatus.error_msg());
        }

        const numPoints = dracoGeometry.num_points();

        for (const [name, { typedArray, id }] of Object.entries(attributes)) {

          const {  dracoType, method } = DracoArrayGetters.get(typedArray.constructor);

          const attribute = decoder.GetAttributeByUniqueId(dracoGeometry, id);
          const numComponents = attribute.num_components();
          const numValues = numPoints * numComponents;

          const dracoArray = new draco[dracoType]();

          decoder[method](dracoGeometry, attribute, dracoArray);

          for (let i = 0; i < numValues; i++) {
            typedArray[i] = dracoArray.GetValue(i);
          }

          attributes[name] = typedArray;

          draco.destroy(dracoArray);
        }

        if (geometryType === draco.TRIANGULAR_MESH) {
          const numFaces = dracoGeometry.num_faces();
          const typedArray = indices;
          const dracoArray = new draco.DracoInt32Array();

          for (let i = 0; i < numFaces; i++) {
            decoder.GetFaceFromMesh(dracoGeometry, i, dracoArray);

            for (let j = 0; j < 3; j++) {
              typedArray[i * 3 + j] = dracoArray.GetValue(j);
            }
          }

          draco.destroy(dracoArray);
        }

        draco.destroy(dracoGeometry);

        self.postMessage({ type: 'decode-return', attributes, indices, taskId });
      } catch(error) {
        self.postMessage({ type: 'decode-return', error, taskId });
      }
    }
  }
}

async function postMessage(message, abortCtl) {
  const worker = workerPool.sort((a, b) => {
    return Object.entries(a.tasks).length - Object.entries(b.tasks).length;
  })[0];

  return new Promise((resolve, reject) => {
    const taskId = worker.nextTaskId++;
    worker.tasks[taskId] = { resolve, reject, abortCtl };
    worker.postMessage({ ...message, taskId });
  });
}

const fn = worker.toString();
const workerBlob = URL.createObjectURL(new Blob([`
  importScripts('${DRACO_DECODER_URL}');
  ${fn.substring(fn.indexOf('{') + 1, fn.lastIndexOf('}'))}
`]));

for(let i = 0; i < WORKERS; i++) {
  const worker = new Worker(workerBlob);

  worker.nextTaskId = 0;
  worker.tasks = {};
  worker.addEventListener('message', (message) => {
    const { type, taskId, error } = message.data;
    if(type === 'decode-return') {
      const task = worker.tasks[taskId];
      if(task) {
        if(task.abortCtl && task.abortCtl.signal && task.abortCtl.signal.aborted) task.reject(new DOMException('Aborted', 'AbortError'));
        else if(error) task.reject(error);
        else task.resolve(message.data)
        delete worker.tasks[taskId];
      }
    }
  });
  workerPool[i] = worker;
}

/**
 * KHR_draco_mesh_compression primitive extension
 * @typedef {glTFProperty} khrDracoMeshCompressionPrimitive
 * @property {Number} bufferView - The index of the bufferView.
 * @property {Object} attributes - A dictionary object, where each key corresponds to an attribute and its unique
 * attribute id stored in the compressed geometry.
 */

 /**
  * A class wrapper for the gltf khrDracoMeshCompressionPrimitive object.
  */
export class KHRDracoMeshCompressionPrimitive extends GLTFProperty {
  #primitive;

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

    this.#primitive = primitive;
  }

  static referenceFields = [
    { name: 'bufferView', type: 'collection', collection: 'bufferViews' },
  ];

  async load(abortCtl) {
    const { buffer, byteOffset = 0, byteLength } = this.bufferView;

    await Promise.all([
      buffer.loadOnce(abortCtl), this.#primitive.indices.loadOnce(abortCtl),
      ...Object.values(this.#primitive.attributes).map(accessor => accessor.loadOnce(abortCtl)),
    ]);

    const arrayBuffer = buffer.getArrayBuffer();
    const attributes = Object.fromEntries(Object.entries(this.attributes).map(([name, id]) => {
      const accessor = this.#primitive.attributes[name];
      const typedArray =  accessor.getTypedArray();
      return [name, { typedArray, id }];
    }));

    const indices = this.#primitive.indices.getTypedArray();
    const response = await postMessage({
      type: 'decode', arrayBuffer, byteOffset, byteLength, attributes, indices
    }, abortCtl);

    if(typeof SharedArrayBuffer === 'undefined') {
      for (const [name, arrayBuffer] of Object.entries(response.attributes)) {
        const accessor = this.#primitive.attributes[name];
        const accessorArray = accessor.getArrayBuffer();
        new Uint8Array(accessorArray).set(new Uint8Array(arrayBuffer.buffer));
      }
    }

    const accessor = this.#primitive.indices;
    new Uint8Array(accessor.getArrayBuffer()).set(new Uint8Array(response.indices.buffer));
  }
}

extensions.set('KHR_draco_mesh_compression', {
  schema: {
    Primitive: KHRDracoMeshCompressionPrimitive,
  },
});
