import { NamedGLTFProperty } from './gltf-property.js';

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
   */
  constructor(skin) {
    super(skin);

    const { inverseBindMatrices, skeleton, joints = [] } = skin;

    /**
     * The Accessor or the index of the Accessor containing the floating-point 4x4 inverse-bind matrices. The default is
     * that each matrix is a 4x4 identity matrix, which implies that inverse-bind matrices were pre-applied.
     * @type {Number|Accessor}
     */
    this.inverseBindMatrices = inverseBindMatrices;

    /**
     * The Node or the index of the Node used as a skeleton root. When undefined, joints transforms resolve to scene root.
     * @type {Number|Node}
     */
    this.skeleton = skeleton;

    /**
     * Skeleton Nodes, used as joints in this skin.
     * @type {Number[]|Node[]}
     */
    this.joints = joints;
  }

  /**
   * Dereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  dereference(root) {
    this.dereferenceFromCollection('inverseBindMatrices', root.accessors);
    this.dereferenceFromCollection('skeleton', root.nodes);
    this.dereferenceFromCollection('joints', root.nodes);
    super.dereference(root);
  }

  /**
   * Rereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  rereference(root) {
    this.rereferenceFromCollection('inverseBindMatrices', root.accessors);
    this.rereferenceFromCollection('skeleton', root.nodes);
    this.rereferenceFromCollection('joints', root.nodes);
    super.rereference(root);
  }
}

export default Skin;
