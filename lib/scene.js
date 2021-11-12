import { NamedGLTFProperty } from './gltf-property.js';
import { Graph             } from './utils/graph.js';

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

    Object.defineProperty(this, 'graph', { value: new Graph(this) });
  }

  static referenceFields = [
    { name: 'nodes', type: 'collection', collection: 'nodes' },
  ];

  * depthFirstSearch() {
    for(const node of this.nodes) {
      for(const n of node.depthFirstSearch()) {
        yield n;
      }
    }
  }

  * breadthFirstSearch() {
    for(const node of this.nodes) {
      for(const n of node.breadthFirstSearch()) {
        yield n;
      }
    }
  }
}

export default Scene;
