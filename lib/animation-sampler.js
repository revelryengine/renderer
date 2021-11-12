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

 let ids = 0;
 
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

    Object.defineProperty(this, '$id', { value: ids++ });

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

  static referenceFields = [
    { name: 'input',  type: 'collection', collection: 'accessors' },
    { name: 'output', type: 'collection', collection: 'accessors' },
  ];
}

export default AnimationSampler;
