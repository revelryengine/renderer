/**
 * @typedef {Object} glTFProperty
 * @property {Object} [extensions] - Dictionary object with extension-specific objects.
 * @property {any} [extras] - Application-specific data.
 */

/**
 * GLTFProperty
 */
export class GLTFProperty {
  /**
   * Creates an instance of GLTFProperty
   * @param {glTFProperty} glTFProperty - The properties of the GLTFProperty
   * @param {WebGLTF} [root=this] - The root WebGLTF object.
   */
  constructor(glTFProperty, root = this) {
    const { extensions, extras } = glTFProperty;

    /**
     * Dictionary object with extension-specific objects.
     * @type {Object}
     */
    this.extensions = extensions;

    /**
     * Application-specific data.
     * @type {any}
     */
    this.extras = extras;

    Object.defineProperty(this, '$root', { value: root });
  }
}

export default GLTFProperty;
