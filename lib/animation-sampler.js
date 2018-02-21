import { GLTFProperty } from './gltf-property.js';
/**
 * Combines input and output accessors with an interpolation algorithm to define a keyframe graph (but not its target).
 * @typedef {glTFProperty} animationSampler
 * @property {Number} input - The index of an accessor containing keyframe input values, e.g., time.
 * @property {String} [interpolation="LINEAR"] - Interpolation algorithm.
 * @property {Number} output - The index of an accessor, containing keyframe output values.
 *
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#animation-sampler
 */

/**
 * A class wrapper around the glTF animationSmapler object.
 */
export class AnimationSampler extends GLTFProperty {
  /**
   * Creates an instance of AnimationSampler.
   * @param {animationSampler} animationSampler - The properties of the animationSampler.
   * @param {WebGLTF} [root=this] - The root WebGLTF object.
   */
  constructor(animationSampler, root) {
    super(animationSampler, root);

    const { input, interpolation = 'LINEAR', output } = animationSampler;

    /**
     * The accessor containing keyframe input values, e.g., time.
     * @type {Accessor}
     */
    this.input = root.accessors[input];

    /**
     * Interpolation algorithm.
     * @type {String}
     */
    this.interpolation = interpolation;

    /**
     * The Accessor, containing keyframe output values.
     * @type {Accessor}
     */
    this.output = root.accessors[output];
  }

  /**
   * Re-references any glTF index properties.
   */
  toJSON() {
    return {
      ...this,
      input: this.$root.accessors.indexOf(this.input),
      output: this.$root.accessors.indexOf(this.output),
    };
  }
}

export default AnimationSampler;
