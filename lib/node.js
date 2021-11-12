import { NamedGLTFProperty } from './gltf-property.js';

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

let ids = 0;
/**
 * A class wrapper for the glTF node object.
 */
export class Node extends NamedGLTFProperty {
  /**
   * Creates an instance of Node.
   * @param {node} node - The properties of the node.
   */
  constructor(node) {
    super(node);

    Object.defineProperty(this, '$id', { value: ids++ });

    const {
      camera, children = [], skin, matrix, scale, rotation, translation, mesh, weights,
    } = node;

    /**
     * The Camera or index of the Camera referenced by this node.
     * @type {Number|Camera}
     */
    this.camera = camera;

    /**
     * The node's children.
     * @type {Number[]|Node[]}
     */
    this.children = children;

    /**
     * The Skin or index of the Skin referenced by this node.
     * @type {Number|Skin}
     */
    this.skin = skin;

    /**
     * A floating-point 4x4 transformation matrix stored in column-major order.
     * @type {Number[]}
     */
    this.matrix = matrix ? [...matrix] : undefined;

    /**
     * The Mesh or the index of the Mesh in this node.
     * @type {Number|Mesh}
     */
    this.mesh = mesh;

    /**
     * The node's unit quaternion rotation in the order (x, y, z, w), where w is the scalar.
     * @type {Number[]}
     */
    this.rotation = rotation ? [...rotation] : undefined;

    /**
     * The node's non-uniform scale, given as the scaling factors along the x, y, and z axes.
     * @type {Number[]}
     */
    this.scale = scale;

    /**
     * The node's translation along the x, y, and z axes.
     * @type {Number[]}
     */
    this.translation = translation ? [...translation] : undefined;

    /**
     * The weights of the instantiated Morph Target. Number of elements must match number of Morph Targets of used mesh.
     * @type {Number[]}
     */
    this.weights = weights;
  }

  static referenceFields = [
    { name: 'camera',   type: 'collection', collection: 'cameras' },
    { name: 'skin',     type: 'collection', collection: 'skins' },
    { name: 'mesh',     type: 'collection', collection: 'meshes' },
    { name: 'children', type: 'collection', collection: 'nodes' },
  ];

  /**
   * Returns the number of morph targets in the first primitive of the node's mesh. If mesh or targets is not defined
   * 0 is returned.
   * @returns {Number}
   */
  getNumberOfMorphTargets() {
    return this.mesh && this.mesh.primitives[0].targets ? this.mesh.primitives[0].targets.length : 0;
  }

  /**
   * Depth first search through nodes and their children
   */
  * depthFirstSearch() {
    for(const node of this.children) {
      yield * node.depthFirstSearch();
    }
    yield this;
  }

  /**
   * Breadth first search through nodes and their children
   */
  * breadthFirstSearch() {
    yield this;

    for(const node of this.children) {
      yield * node.breadthFirstSearch();
    }
  }
}

export default Node;
