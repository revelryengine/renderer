import { NamedGLTFProperty } from './named-gltf-property.js';

/**
 * The root nodes of a scene.
 * @typedef {namedGLTFProperty} scene
 * @property {Number[]} [nodes] - The indices of each root node.
 *
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#scene
 */

/**
 * A class wrapper around the glTF scene object.
 */
export class Scene extends NamedGLTFProperty {
  /**
   * Creates an instance of Scene.
   * @param {scene} scene - The properties of the scene.
   * @param {WebGLTF} [root=this] - The root WebGLTF object.
   */
  constructor(scene, root) {
    super(scene, root);

    const { nodes = [] } = scene;

    /**
     * Each root Node.
     * @type {Number[]|Node[]}
     */
    this.nodes = nodes;
  }

  /**
   * Dereference glTF index properties.
   */
  dereference() {
    super.dereference('nodes', 'nodes');
  }

  /**
   * Rereference glTF index properties.
   */
  rereference() {
    super.rereference('nodes', 'nodes');
  }
}

export default Scene;
