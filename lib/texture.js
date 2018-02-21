

import { NamedGLTFProperty } from './named-gltf-property.js';

/**
 * A texture and its sampler.
 * @typedef {namedGLTFProperty} texture
 * @property {Number} [sampler] - The index of the sampler used by this texture. When undefined, a sampler with repeat
 *  wrapping and auto filtering should be used.
 * @property {Number} [source] - The index of the image used by this texture.
 *
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#texture
 */

/**
 * A class wrapper around the glTF texture object.
 */
export class Texture extends NamedGLTFProperty {
  /**
   * Creates an instance of Texture.
   * @param {texture} texture - The properties of the texture.
   * @param {WebGLTF} [root=this] - The root WebGLTF object.
   */
  constructor(texture, root) {
    super(texture, root);

    const { sampler, source } = texture;

    /**
     * The Sampler used by this texture. When undefined, a sampler with repeat wrapping and auto filtering
     * should be used.
     * @type {Sampler}
     */
    this.sampler = root.samplers[sampler];

    /**
     * The Image used by this texture.
     * @type {Image}
     */
    this.source = root.images[source];
  }

  /**
   * Re-references any glTF index properties.
   */
  toJSON() {
    return {
      ...this,
      sampler: this.$root.samplers.indexOf(this.sampler),
      source: this.$root.images.indexOf(this.source),
    };
  }
}

export default Texture;

