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
   */
  constructor(glTFProperty) {
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
  }

  /**
   * Dereference index properties. Convertes indexes to references of objects.
   * @param {String} prop - The property to retrieve the index from. If property is an array, each item will be dereferenced.
   * @param {Array} collection - The collection to retreive the object from by index.
   */
  dereference(prop, collection) {
    if (typeof this[prop] === 'number') {
      this[prop] = collection[this[prop]];
    } else if (this[prop] instanceof Array) {
      for (let i = 0; i < this[prop].length; i++) {
        if (typeof this[prop][i] === 'number') {
          this[prop][i] = collection[this[prop][i]];
        }
      }
    }
  }

  /**
   * Rereference index properties. Converts references of objects to indexes.
   * @param {String} prop - The property to retrieve the object from. If property is an array, each item will be rereferenced.
   * @param {String} collection - The collection name to retreive the index from by indexOf(object).
   */
  rereference(prop, collection) {
    if (typeof this[prop] === 'number') {
      this[prop] = collection.indexOf(this[prop]);
    } else if (this[prop] instanceof Array) {
      for (let i = 0; i < this[prop].length; i++) {
        if (typeof this[prop][i] === 'number') {
          this[prop][i] = collection.indexOf(this[prop][i]);
        }
      }
    }
  }
}

export default GLTFProperty;
