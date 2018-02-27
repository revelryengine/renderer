import { NamedGLTFProperty } from './named-gltf-property.js';
import { Primitive         } from './primitive.js';

/**
* A set of primitives to be rendered. A node can contain one mesh. A node's transform places the mesh in the scene.
* @typedef {namedGLTFProperty} mesh
* @property {primitive[]} primitives - An array of primitives, each defining geometry to be rendered with a
* material.
* @property {Number[]} [weights] - Array of weights to be applied to the Morph Targets.
*
* @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#mesh
*/

/**
 * A class wrapper around the glTF mesh object.
 * @todo Investigate dereferencing further.
 */
export class Mesh extends NamedGLTFProperty {
  /**
   * Creates an instance of Mesh.
   * @param {mesh} mesh - The properties of the mesh.
   * @param {WebGLTF} [root=this] - The root WebGLTF object.
   */
  constructor(mesh, root) {
    super(mesh, root);

    const { primitives = [], weights = [] } = mesh;
    /**
     * An array of Primitives, each defining geometry to be rendered with a material.
     * @type {Primitive[]}
     */
    this.primitives = primitives.map(primitive => new Primitive(primitive, root));

    /**
     * Array of weights to be applied to the Morph Targets.
     * @type {Number[]}
     */
    this.weights = weights;
  }
}

export default Mesh;
