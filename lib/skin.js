import { NamedGLTFProperty } from './named-gltf-property.js';

/**
 * Joints and matrices defining a skin.
 * @typedef {namedGLTFProperty} skin
 * @property {Number} [inverseBindMatrices] - The index of the accessor containing the floating-point 4x4 inverse-bind
 * matrices. The default is that each matrix is a 4x4 identity matrix, which implies that inverse-bind matrices were
 * pre-applied.
 * @property {Number} [skeleton] - The index of the node used as a skeleton root. When undefined, joints transforms
 * resolve to scene root.
 * @property {Number[]} joints - Indices of skeleton nodes, used as joints in this skin.
 *
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#skin
 */

/**
 * A class wrapper around the glTF skin object.
 */
export class Skin extends NamedGLTFProperty {
  /**
   * Creates an instance of Skin.
   * @param {skin} skin - The properties of the skin.
   * @param {WebGLTF} [root=this] - The root WebGLTF object.
   */
  constructor(skin, root) {
    super(skin, root);

    const { inverseBindMatrices, skeleton, joints = [] } = skin;

    /**
     * The Accessor containing the floating-point 4x4 inverse-bind matrices. The default is that each matrix is a 4x4
     * identity matrix, which implies that inverse-bind matrices were pre-applied.
     * @type {Accessor}
     */
    this.inverseBindMatrices = root.accessors[inverseBindMatrices];

    /**
     * The Node used as a skeleton root. When undefined, joints transforms resolve to scene root.
     * @type {Node}
     */
    this.skeleton = root.nodes[skeleton];

    /**
     * Skeleton Nodes, used as joints in this skin.
     * @type {Node[]}
     */
    this.joints = joints.map(joint => root.nodes[joint]);
  }

  /**
   * Re-references any glTF index properties.
   */
  toJSON() {
    return {
      ...this,
      inverseBindMatrices: this.$root.accessors.indexOf(this.inverseBindMatrices),
      skeleton: this.$root.nodes.indexOf(this.skeleton),
      joints: this.joints.map(joint => this.$root.nodes.indexOf(joint)),
    };
  }
}

export default Skin;
