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
   */
  constructor(namedGLTFProperty) {
    super(namedGLTFProperty);

    const { name } = namedGLTFProperty;

    /**
     * The user-defined name of this object.
     * @type {String}
     */
    this.name = name;
  }
}

export default GLTFProperty;
