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

 let count = 0;
/**
 * A class wrapper around the glTF primitive object.
 */
export class Primitive extends GLTFProperty {
  /**
   * Creates an instance of Primitive.
   * @param {primitive} primitive - The properties of the primitive.
   */
  constructor(primitive) {
    super(primitive);
    this._id = count++;
    const { attributes, indices, material, mode = 4, targets } = primitive;

    /**
     * A dictionary object, where each key corresponds to mesh attribute semantic and each value is the Accssor or the
     * index of the Accessor containing attribute's data.
     * @type {Object.<String, Number>|Object.<String, Accessor>}
     */
    this.attributes = attributes;

    /**
     * The Accessor or the index of the Accessor that contains the indices.
     * @type {Number|Accessor}
     */
    this.indices = indices;

    /**
     * The Material or the  index of the Material to apply to this primitive when rendering.
     * @type {Number|Material}
     */
    this.material = material;

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
   * Dereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  dereference(root) {
    this.dereferenceFromCollection('indices', root.accessors);
    this.dereferenceFromCollection('material', root.materials);

    for (const [name, index] of Object.entries(this.attributes)) {
      if (typeof index === 'number') this.attributes[name] = root.accessors[index];
    }

    if (this.targets) {
      for (const target of this.targets) {
        for (const [name, index] of Object.entries(target)) {
          if (typeof index === 'number') target[name] = root.accessors[index];
        }
      }
    }

    // Target is not required by the spec for indices but ensuring that it is always set greatly reduces the complexity
    // of initialization later
    if (this.indices && this.indices.bufferView) this.indices.bufferView.target = WebGLRenderingContext.ELEMENT_ARRAY_BUFFER;
    super.dereference(root);
  }

  /**
   * Rereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  rereference(root) {
    this.rereferenceFromCollection('indices', root.accessors);
    this.rereferenceFromCollection('material', root.materials);

    for (const [name, accessor] of Object.entries(this.attributes)) {
      if (typeof accessor !== 'number') this.attributes[name] = root.accessors.indexOf(accessor);
    }

    if (this.targets) {
      for (const target of this.targets) {
        for (const [name, accessor] of Object.entries(target)) {
          if (typeof accessor !== 'number') target[name] = root.accessors.indexOf(accessor);
        }
      }
    }
    super.rereference(root);
  }

  createWebGLBuffers(context) {
    const { indices, attributes, targets = [] } = this;
    const accessors = [indices, ...Object.values(attributes)].concat(...targets.map(v => Object.values(v)));
    for (const accessor of accessors) {
      if (accessor) accessor.createWebGLBuffer(context);
    }
  }

  createWebGLTextures(context) {
    if (this.material) {
      const {
        pbrMetallicRoughness = {},
        normalTexture, occlusionTexture, emissiveTexture,
      } = this.material;

      const { baseColorTexture, metallicRoughnessTexture } = pbrMetallicRoughness;

      const textureInfos = [
        baseColorTexture, emissiveTexture, metallicRoughnessTexture, normalTexture, occlusionTexture,
      ];

      for (const textureInfo of textureInfos) {
        if (textureInfo) textureInfo.createWebGLTexture(context);
      }
    }
  }
}

export default Primitive;

