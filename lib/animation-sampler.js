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
   */
  constructor(animationSampler) {
    super(animationSampler);

    const { input, interpolation = 'LINEAR', output } = animationSampler;

    /**
     * The Accessor or the index of the Accessor containing keyframe input values, e.g., time.
     * @type {Number|Accessor}
     */
    this.input = input;

    /**
     * Interpolation algorithm.
     * @type {String}
     */
    this.interpolation = interpolation;

    /**
     * The Accessor or the index of the Accessor containing keyframe output values.
     * @type {Number|Accessor}
     */
    this.output = output;
  }

  /**
   * Dereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  dereference(root) {
    super.dereference('input', root.accessors);
    super.dereference('output', root.accessors);
  }

  /**
   * Rereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  rereference(root) {
    super.rereference('input', root.accessors);
    super.rereference('output', root.accessors);
  }
}

export default AnimationSampler;
