import { NamedGLTFProperty } from './gltf-property.js';
import { Indices } from './indices.js';
import { Values  } from './values.js';

/**
 * Sparse storage of attributes that deviate from their initialization value.
 * @typedef {glTFProperty} sparse
 * @property {Number} count - Number of entries stored in the sparse array.
 * @property {indices} indices - Index array of size count that points to those accessor attributes that
 * deviate from their initialization value. Indices must strictly increase.
 * @property {values} values - Array of size count times number of components, storing the displaced
 * accessor attributes pointed by indices. Substituted values must have the same componentType and number of
 * components as the base accessor.
 *
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#sparse
 */

/**
 * A class wrapper around the glTF sparse object.
 */
export class Sparse extends NamedGLTFProperty {
  /**
   * Creates an instance of Sparse.
   * @param {sparse} sparse - The properties of the sparse.
   */
  constructor(sparse) {
    super(sparse);

    const { count, indices, values } = sparse;

    /**
     * Number of entries stored in the sparse array.
     * @type {Number}
     */
    this.count = count;

    /**
     * Index array of size count that points to those accessor attributes that deviate from their initialization value.
     * Indices must strictly increase.
     * @type {Indices}
     */
    this.indices = new Indices(indices);

    /**
     * Array of size count times number of components, storing the displaced accessor attributes pointed by indices.
     * Substituted values must have the same componentType and number of components as the base accessor.
     * @type {Values}
     */
    this.values = new Values(values);
  }

  /**
   * Dereference glTF index properties.
   */
  dereference(root) {
    this.indices.dereference(root);
    this.values.dereference(root);
    super.dereference(root);
  }

  /**
   * Rereference glTF index properties.
   */
  rereference(root) {
    this.indices.rereference(root);
    this.values.rereference(root);
    this.rereference(root);
  }

  async load(abortCtl) {
    await this.indices.loadOnce(abortCtl);
    await this.values.loadOnce(abortCtl);
  }

}

export default Sparse;
