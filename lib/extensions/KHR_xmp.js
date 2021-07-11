import { extensions   } from '../extensions.js';
import { GLTFProperty } from '../gltf-property.js';

/**
 * @see https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_xmp
 */

/**
 * @typedef {glTFProperty} khrXMPGLTF
 * @property {Object} '@context' - Dictionary mapping XMP namespace names to the URI where they are defined.
 * @property {Object[]} packets - Dictionary of XMP metadata properties. Property names take the form `xmp_namespace_name:property_name`.
 */

/**
 * A class wrapper for the gltf khrXMPGLTF object.
 */
export class KHRXMPGLTF extends GLTFProperty {
  /**
   * Creates an instance of KHRXMPGLTF.
   * @param {khrXMPGLTF} khrXMPGLTF - The properties of the khrXMPGLTF.
   */
  constructor(khrXMPGLTF) {
    super(khrXMPGLTF);

    const { '@context': context, packets  } = khrXMPGLTF;

    /**
     * Dictionary mapping XMP namespace names to the URI where they are defined.
     * @type {Object}
     */
    this['@context'] = context;

    /**
     * Dictionary of XMP metadata properties. Property names take the form `xmp_namespace_name:property_name`.
     * @type {Object[]}
     */
    this.packets = packets;
  }
}

/**
 * @typedef {glTFProperty} khrXMPNode
 * @property {Number} packet - The id of the XMP packet referenced by this node.
 */

/**
 * A class wrapper for the gltf khrXMPNode object.
 */
 export class KHRXMPNode extends GLTFProperty {
  /**
   * Creates an instance of KHRXMPGLTF.
   * @param {khrXMPNode} khrXMPNode - The properties of the khrXMPNode.
   */
  constructor(khrXMPNode) {
    super(khrXMPNode);

    const { packet  } = khrXMPNode;

    /**
     * The XMP packet or the index of the XMP packet referenced by this node.
     * @type {Number|Object}
     */
    this.packet = packet;
  }

  static referenceFields = [
    { name: 'packet', type: 'collection', collection: ['extensions', 'KHR_xmp', 'packets'] },
  ];
}

extensions.set('KHR_xmp', {
  schema: {
    WebGLTF:   KHRXMPGLTF,
    Asset:     KHRXMPNode,
    Scene:     KHRXMPNode,
    Node:      KHRXMPNode,
    Mesh:      KHRXMPNode,
    Material:  KHRXMPNode,
    Image:     KHRXMPNode,
    Animation: KHRXMPNode,
  }
});
