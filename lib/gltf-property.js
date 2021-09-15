import { extensions } from './extensions.js';

/**
 * @typedef {Object} glTFProperty
 * @property {Object} [extensions] - Dictionary object with extension-specific objects.
 * @property {Object} [extras] - Application-specific data.
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
  constructor(glTFProperty = {}) {
    if(glTFProperty instanceof GLTFProperty) return glTFProperty;

    const { extensions: _extensions = {}, extras = {} } = glTFProperty;

    /**
     * Dictionary object with extension-specific objects.
     * @todo map extensions by instanceof constructor not name string
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
     * @type {Object}
     */
    this.extras = extras;
  }

  static referenceFields = [];

  dereference(root, parent) {
    for(const { name, type, collection, alias, location = 'root', assign = {} } of this.constructor.referenceFields) {
      const locations = { root, parent };
      switch(type) {
        case 'collection': {
          const srcLocation = locations[location];
          const srcCollection = typeof collection === 'string' ? srcLocation[collection] : collection.reduce((obj, key) => obj[key], srcLocation);
          this.dereferenceFromCollection(name, srcCollection, alias, assign);
          break;
        }
        case 'sub': {
          if(this[name]) {
            if (this[name] instanceof Array) {
              for(const sub of this[name]){
                sub.dereference(root, this);
                Object.assign(sub, assign);
              }
            } else {
              this[name].dereference(root, this);
              Object.assign(this[name], assign);
            }
          }
          break;
        }
        case 'uri': {
          if (this[name] && (typeof this[name] === 'string')) {
            const original = this[name];
            this[name] = new URL(this[name], root.$uri);
            this[name].$original = original;
          }
          break;
        }
      }
    }

    for(const ext of Object.values(this.extensions)) {
      ext.dereference?.(root, this);
    }
  }

  rereference(root, parent) {
    for(const { name, type, collection, alias, location = 'root' }  of this.constructor.referenceFields) {
      const locations = { root, parent };
      switch(type) {
        case 'collection': {
          const srcLocation = locations[location];
          const srcCollection = typeof collection === 'string' ? srcLocation[collection] : collection.reduce((obj, key) => obj[key], srcLocation);
          this.rereferenceFromCollection(name, srcCollection, alias);
          break;
        }
        case 'sub': {
          if(this[name]) {
            if (this[name] instanceof Array) {
              for(const sub of this[name]){
                sub.rereference(root, this);
              }
            } else {
              this[name].rereference(root, this);
            }
          }
          break;
        }
        case 'uri': {
          this[name] = this[name].$original || this[name].toString();
          break;
        }
      }
    }

    for(const ext of Object.values(this.extensions)) {
      ext.rereference?.(root, this);
    }
  }

  ensureReferences(root, collection) {
    if(root[collection].indexOf(this) === -1) root[collection].push(this);

    for(const { item, parent, ref } of this.traverseReferences(root)){
      const { type, collection, location = 'root' } = ref;
      const locations = { root, parent };

      if(type === 'collection') {
        const srcLocation   = locations[location];
        const srcCollection = GLTFProperty.ensureCollectionExists(srcLocation, collection);
        if(srcCollection.indexOf(item) === -1) srcCollection.push(item);
      }
    }
  }

  * traverseReferences(root, parent) {
    for(const ref of this.constructor.referenceFields) {
      const src = ref.alias || ref.name;

      if(ref.type === 'collection' || ref.type === 'sub') {
        if(this[src] instanceof GLTFProperty) {
          yield { item: this[src], ref, root, parent };
          yield * this[src].traverseReferences(root, this);
        } else if (this[src] instanceof Array) {
          for(const sub of this[src]){
            yield { item: sub, ref, root, parent };
            yield * sub.traverseReferences(root, this);
          }
        } else if(this[src] instanceof Object) {
          for(const sub of Object.values(this[src])){
            yield { item: sub, ref, root, parent };
            yield * sub.traverseReferences(root, this);
          }
        }
      }
    }

    for(const ext of Object.values(this.extensions)) {
      yield * ext.traverseReferences?.(root, this);
    }

    for(const ext of Object.values(this.extras)) {
      yield * ext.traverseReferences?.(root, this);
    }
  } 

  async load(abortCtl) {
    return Promise.all(Object.values(this.extensions).map(ext => {
      if(ext.load) return ext.load(abortCtl);
    }));
  }

  async loadOnce(abortCtl) {
    return pending.get(this) || pending.set(this, this.load(abortCtl)).get(this);
  }

  /**
   * Dereference index properties. Convertes indexes to references of objects.
   * @param {String} prop - The property to retrieve the index from. If property is an array, each item will be dereferenced.
   * @param {Array} collection - The collection to retreive the object from by index.
   * @param {String} [alias] - If alias is specified, the reference is stored on item[alias] instead of item[prop].
   */
  dereferenceFromCollection(prop, collection, alias, assign = {}) {
    const dest = alias || prop;
    if (typeof this[prop] === 'number') {
      this[dest] = collection[this[prop]];
      Object.assign(this[dest], assign);
    } else if (this[prop] instanceof Array) {
      if(!this[dest]) this[dest] = [];
      for (let i = 0; i < this[prop].length; i++) {
        if (typeof this[prop][i] === 'number') {
          this[dest][i] = collection[this[prop][i]];
        }
        Object.assign(this[dest][i], assign);
      }
    } else if(this[prop] && !(this[prop] instanceof GLTFProperty)) {
      if(!this[dest]) this[dest] = {};
      for (const [name, index] of Object.entries(this[prop])) {
        if (typeof index === 'number') this[dest][name] = collection[index];
        Object.assign(this[dest][name], assign);
      }
    }
  }

  /**
   * Rereference index properties. Converts references of objects to indexes.
   * @param {String} prop - The property to retrieve the object from. If property is an array, each item will be rereferenced.
   * @param {Array} collection - The collection to retreive the index from by indexOf(object).
   * @param {String} [alias] - If alias is specified, the reference is retrieved from item[alias] instead of item[prop].
   */
  rereferenceFromCollection(prop, collection, alias) {
    const src = alias || prop;
    if (typeof this[prop] === 'number') {
      this[prop] = collection.indexOf(this[src]);
    } else if (this[prop] instanceof Array) {
      for (let i = 0; i < this[prop].length; i++) {
        if (typeof this[prop][i] === 'number') {
          this[prop][i] = collection.indexOf(this[src][i]);
        }
      }
    } else if(this[prop] && !(this[prop] instanceof GLTFProperty)) {
      for (const [name, obj] of Object.entries(this[src])) {
        if (typeof obj !== 'number') this[prop][name] = collection.indexOf(obj);
      }
    }
    if(alias) delete this[alias];
  }

  static ensureCollectionExists(location, collection) {
    if(collection instanceof Array){
      const [prop, name]  = collection;
      if(prop === 'extensions' && !location.extensions[name]) {
        const ext = extensions.get(name);
        const Construct = ext.schema[location.constructor.name];
        location.extensions[name] = new Construct({});
      }

      const srcLocation = collection.slice(0, -1).reduce((obj, key) => obj[key], location);
      const key = collection[collection.length - 1];
      return srcLocation[key] = srcLocation[key] || [];
    } else {
      return location[collection] = location[collection] || []; 
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
