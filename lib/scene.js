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
     * @type {Node[]}
     */
    this.nodes = nodes.map(node => root.nodes[node]);
  }

  /**
   * Re-references any glTF index properties.
   */
  toJSON() {
    return {
      ...this,
      nodes: this.nodes.map(node => this.$root.nodes.indexOf(node)),
    };
  }
}

export default Scene;
