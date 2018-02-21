import { GLTFProperty } from './gltf-property.js';

/**
 * Geometry to be rendered with the given material.
 * @typedef {glTFProperty} primitive
 * @property {Object} attributes - A dictionary object, where each key corresponds to mesh attribute semantic and each
 * value is the index of the accessor containing attribute's data.
 * @property {Number} [indices] - The index of the accessor that contains the indices.
 * @property {Number} [material] - The index of the material to apply to this primitive when rendering.
 * @property {Number} [mode=4] - The type of primitives to render.
 * @property {Object} [targets] - An array of Morph Targets, each Morph Target is a dictionary mapping attributes (only
 * `POSITION`, `NORMAL`, and `TANGENT` supported) to their deviations in the Morph Target.
 *
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#primitive
 */


/**
 * A class wrapper around the glTF primitive object.
 */
export class Primitive extends GLTFProperty {
  /**
   * Creates an instance of Primitive.
   * @param {primitive} primitive - The properties of the primitive.
   * @param {WebGLTF} [root=this] - The root WebGLTF object.
   */
  constructor(primitive, root) {
    super(primitive, root);

    const { attributes, indices, material, mode = 4, targets } = primitive;

    /**
     * A dictionary object, where each key corresponds to mesh attribute semantic and each value is the index of the
     * accessor containing attribute's data.
     * @type {Object.<String, Accessor>}
     */
    this.attributes = {};
    for (const [name, index] of Object.entries(attributes)) {
      this.attributes[name] = root.accessors[index];
    }

    /**
     * The Accessor that contains the indices.
     * @type {Accessor}
     */
    this.indices = root.accessors[indices];

    /**
     * The Material to apply to this primitive when rendering.
     * @type {Material}
     */
    this.material = root.materials[material];

    /**
     * The type of primitives to render.
     * @type {Number}
     */
    this.mode = mode;

    /**
     * An array of Morph Targets, each Morph Target is a dictionary mapping attributes (only
     * `POSITION`, `NORMAL`, and `TANGENT` supported) to their deviations in the Morph Target.
     * @type {Object[]}
     */
    this.targets = targets;
  }

  /**
   * Re-references any glTF index properties.
   */
  toJSON() {
    const attributes = {};
    for (const [name, accessor] of Object.entries(attributes)) {
      this.attributes[name] = root.accessors.indexOf(accessor);
    }
    return {
      ...this,
      attributes,
      indices: this.$root.accessors.indexOf(this.indices),
      material: this.$root.materials.indexOf(this.material),
    };
  }
}

export default Primitive;

