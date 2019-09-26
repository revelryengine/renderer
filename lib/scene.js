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
   */
  constructor(scene) {
    super(scene);

    const { nodes = [] } = scene;

    /**
     * Each root Node.
     * @type {Number[]|Node[]}
     */
    this.nodes = nodes;
  }

  /**
   * Dereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  dereference(root) {
    this.dereferenceFromCollection('nodes', root.nodes);
    super.dereference(root);
  }

  /**
   * Rereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  rereference(root) {
    this.rereferenceFromCollection('nodes', root.nodes);
    super.rereference(root);
  }
}

export default Scene;
