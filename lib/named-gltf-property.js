import { GLTFProperty } from './gltf-property.js';

/**
 * @typedef {glTFProperty} namedGLTFProperty
 * @property {String} [name] - The user-defined name of this object.
 */

/**
 * NamedGLTFProperty
 */
export class NamedGLTFProperty extends GLTFProperty {
  /**
   * Creates an instance of NamedGLTFProperty
   * @param {namedGLTFProperty} namedGLTFProperty - The properties of the NamedGLTFProperty
   * @param {WebGLTF} [root=this] - The root WebGLTF object.
   */
  constructor(namedGLTFProperty, root) {
    super(namedGLTFProperty, root);

    const { name } = namedGLTFProperty;

    /**
     * The user-defined name of this object.
     * @type {String}
     */
    this.name = name;
  }
}

export default GLTFProperty;
