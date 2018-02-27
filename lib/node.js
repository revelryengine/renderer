import { mat4 } from '../vendor/gl-matrix.js';
import { NamedGLTFProperty } from './named-gltf-property.js';

/**
 * A node in the node hierarchy. When the node contains {@link skin}, all `mesh.primitives` must contain `JOINTS_0` and
 * `WEIGHTS_0` attributes. A node can have either a `matrix` or any combination of `translation`/`rotation`/`scale`
 * (TRS) properties. TRS properties are converted to matrices and postmultiplied in the `T * R * S` order to compose the
 * transformation matrix; first the scale is applied to the vertices, then the rotation, and then the translation. If
 * none are provided, the transform is the identity. When a node is targeted for animation (referenced by an
 * `animation.channel.target`), only TRS properties may be present; `matrix` will not be present.
 * @typedef {namedGLTFProperty} node
 * @property {Number} [camera] - The index of the camera referenced by this node.
 * @property {Number[]} [children] - The indices of this node's children.
 * @property {Number} [skin] - The index of the skin referenced by this node.
 * @property {Number[]} [matrix=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]] - A floating-point 4x4 transformation matrix
 * stored in column-major order.
 * @property {Number} [mesh] - The index of the mesh in this node.
 * @property {Number[]} [rotation=[0,0,0,1]] - The node's unit quaternion rotation in the order (x, y, z, w),
 * where w is the scalar.
 * @property {Number[]} [scale=[1,1,1]] - The node's non-uniform scale, given as the scaling factors along the x,
 * y, and z axes.
 * @property {Number[]} [translation=[0,0,0]] - The node's translation along the x, y, and z axes.
 * @property {Number[]} [weights] - The weights of the instantiated Morph Target. Number of elements must match
 * number of Morph Targets of used mesh.
 *
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#node
 */

/**
 * A class wrapper for the glTF node object.
 */
export class Node extends NamedGLTFProperty {
  /**
   * Creates an instance of Node.
   * @param {node} node - The properties of the node.
   * @param {WebGLTF} [root=this] - The root WebGLTF object.
   */
  constructor(node, root) {
    super(node, root);

    const {
      camera, children = [], skin, matrix, mesh, translation, rotation, scale, weights = [],
    } = node;

    let $matrix;
    if (matrix) {
      $matrix = mat4.clone(matrix);
    } else if (translation && rotation && scale) {
      $matrix = mat4.fromRotationTranslationScale(mat4.create(), rotation, translation, scale);
    } else {
      $matrix = mat4.create();
    }

    /**
     * The Camera referenced by this node.
     * @type {Camera}
     */
    this.camera = root.cameras[camera];

    /**
     * The node's children.
     * @type {Node[]}
     */
    this.children = children.map(child => root.nodes[child]);

    /**
     * The Skin referenced by this node.
     * @type {Skin}
     */
    this.skin = root.skins[skin];

    /**
     * A floating-point 4x4 transformation matrix stored in column-major order.
     * @type {Number[]}
     */
    this.matrix = $matrix;

    /**
     * The Mesh in this node.
     * @type {Mesh}
     */
    this.mesh = root.meshes[mesh];

    /**
     * The node's unit quaternion rotation in the order (x, y, z, w), where w is the scalar.
     * @type {Number[]}
     */
    this.rotation = rotation;

    /**
     * The node's non-uniform scale, given as the scaling factors along the x, y, and z axes.
     * @type {Number[]}
     */
    this.scale = scale;

    /**
     * The node's translation along the x, y, and z axes.
     * @type {Number[]}
     */
    this.translation = translation;

    /**
     * The weights of the instantiated Morph Target. Number of elements must match number of Morph Targets of used mesh.
     * @type {Number[]}
     */
    this.weights = weights;
  }

  /**
   * Re-references any glTF index properties.
   */
  toJSON() {
    return {
      ...this,
      camera: this.$root.cameras.indexOf(this.camera),
      children: this.children.map(child => this.$root.nodes.indexOf(child)),
      skin: this.$root.skins.indexOf(this.skin),
      mesh: this.$root.meshes.indexOf(this.mesh),
    };
  }
}

export default Node;
