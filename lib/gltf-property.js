import { extensions } from './extensions.js';

/**
 * @typedef {Object} glTFProperty
 * @property {Object} [extensions] - Dictionary object with extension-specific objects.
 * @property {any} [extras] - Application-specific data.
 */

 const pending = new WeakMap();

/**
 * GLTFProperty
 */
export class GLTFProperty {
  /**
   * Creates an instance of GLTFProperty
   * @param {glTFProperty} glTFProperty - The properties of the GLTFProperty
   */
  constructor(glTFProperty) {
    const { extensions: _extensions = {}, extras } = glTFProperty;

    /**
     * Dictionary object with extension-specific objects.
     * @type {Object}
     */
    this.extensions = Object.fromEntries(Object.entries(_extensions).map(([name, value]) => {
      const ext = extensions.get(name);
      const Construct = ext && ext.schema[this.constructor.name];
      if(Construct) {
        return [name, new Construct(value, this)];
      }
      return [name, value];
    }));

    /**
     * Application-specific data.
     * @type {any}
     */
    this.extras = extras;
  }

  rereference(root) {
    for(const ext of Object.values(this.extensions)) {
      if(ext.rereference) {
        ext.rereference(root);
      }
    }
  }

  dereference(root) {
    for(const ext of Object.values(this.extensions)) {
      if(ext.dereference) {
        ext.dereference(root);
      }
    }
  }

  async load() {
    return Promise.all(Object.values(this.extensions).map(ext => {
      if(ext.load) return ext.load();
    }));
  }

  async loadOnce() {
    return pending.get(this) || pending.set(this, this.load()).get(this);
  }

  /**
   * Dereference index properties. Convertes indexes to references of objects.
   * @param {String} prop - The property to retrieve the index from. If property is an array, each item will be dereferenced.
   * @param {Array} collection - The collection to retreive the object from by index.
   */
  dereferenceFromCollection(prop, collection) {
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
  rereferenceFromCollection(prop, collection) {
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
