import { GLTFProperty } from './gltf-property.js';

/**
 * The index of the node and TRS property that an animation channel targets.
 * @typedef {glTFProperty} target
 * @property {Number} [node] - The index of the node to target.
 * @property {String} path - The name of the node's TRS property to modify, or the "weights" of the Morph Targets it
 * instantiates. For the "translation" property, the values that are provided by the sampler are the translation along
 * the x, y, and z axes. For the "rotation" property, the values are a quaternion in the order (x, y, z, w), where w is
 * the scalar. For the "scale" property, the values are the scaling factors along the x, y, and z axes.
 *
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#target
 */

/**
 * A class wrapper around the glTF target object.
 */
export class Target extends GLTFProperty {
  /**
   * Creates an instance of Target.
   * @param {target} target - The properties of the target.
   * @param {WebGLTF} [root=this] - The root WebGLTF object.
   */
  constructor(target, root) {
    super(target, root);

    const { node, path } = target;

    /**
     * The Node to target.
     * @type {Node}
     */
    this.node = root.nodes[node];

    /**
     * The name of the node's TRS property to modify, or the "weights" of the Morph Targets it instantiates. For the
     * "translation" property, the values that are provided by the sampler are the translation along the x, y, and z
     * axes. For the "rotation" property, the values are a quaternion in the order (x, y, z, w), where w is the scalar.
     * For the "scale" property, the values are the scaling factors along the x, y, and z axes.
     * @type {String}
     */
    this.path = path;
  }

  /**
   * Re-references any glTF index properties.
   */
  toJSON() {
    return {
      ...this,
      node: this.$root.nodes.indexOf(this.node),
    };
  }
}

export default Target;

