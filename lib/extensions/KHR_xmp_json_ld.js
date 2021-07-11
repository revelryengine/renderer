import { extensions   } from '../extensions.js';
import { GLTFProperty } from '../gltf-property.js';

/**
 * @see https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_xmp_json_ld
 */

/**
 * @typedef {glTFProperty} khrXMPJSONLDGLTF
 * @property {Object[]} packets - Dictionary of XMP metadata properties. Property names take the form `xmp_namespace_name:property_name`.
 */

/**
 * A class wrapper for the gltf khrXMPJSONLDGLTF object.
 */
export class KHRXMPJSONLDGLTF extends GLTFProperty {
  /**
   * Creates an instance of KHRXMPJSONLDGLTF.
   * @param {khrXMPJSONLDGLTF} khrXMPJSONLDGLTF - The properties of the khrXMPJSONLDGLTF.
   */
  constructor(khrXMPJSONLDGLTF) {
    super(khrXMPJSONLDGLTF);

    const { packets } = khrXMPJSONLDGLTF;

    /**
     * Dictionary of XMP metadata properties. Property names take the form `xmp_namespace_name:property_name`.
     * @type {Object[]}
     */
    this.packets = packets;
  }
}

/**
 * @typedef {glTFProperty} khrXMPJSONLDNode
 * @property {Number} packet - The id of the XMP packet referenced by this node.
 */

/**
 * A class wrapper for the gltf khrXMPJSONLDNode object.
 */
 export class KHRXMPJSONLDNode extends GLTFProperty {
  /**
   * Creates an instance of KHRXMPJSONLDGLTF.
   * @param {khrXMPJSONLDNode} khrXMPJSONLDNode - The properties of the khrXMPJSONLDNode.
   */
  constructor(khrXMPJSONLDNode) {
    super(khrXMPJSONLDNode);

    const { packet  } = khrXMPJSONLDNode;

    /**
     * The XMP packet or the index of the XMP packet referenced by this node.
     * @type {Number|Object}
     */
    this.packet = packet;
  }

  static referenceFields = [
    { name: 'packet', type: 'collection', collection: ['extensions', 'KHR_xmp_json_ld', 'packets'] },
  ];
}

extensions.set('KHR_xmp_json_ld', {
  schema: {
    WebGLTF:   KHRXMPJSONLDGLTF,
    Asset:     KHRXMPJSONLDNode,
    Scene:     KHRXMPJSONLDNode,
    Node:      KHRXMPJSONLDNode,
    Mesh:      KHRXMPJSONLDNode,
    Material:  KHRXMPJSONLDNode,
    Image:     KHRXMPJSONLDNode,
    Animation: KHRXMPJSONLDNode,
  }
});
