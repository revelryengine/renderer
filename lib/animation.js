import { NamedGLTFProperty } from './named-gltf-property.js';
import { AnimationSampler  } from './animation-sampler.js';
import { Channel           } from './channel.js';

/**
 * A keyframe animation.
 * @typedef {namedGLTFProperty} animation
 * @property {channel[]} channels - An array of channels, each of which targets an animation's sampler at a
 * node's property. Different channels of the same animation can't have equal targets.
 * @property {animationSampler[]} samplers - An array of samplers that combines input and output accessors with an
 * interpolation algorithm to define a keyframe graph (but not its target).
 *
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#animation
 */

/**
 * A class wrapper for glTF animation object.
 */
export class Animation extends NamedGLTFProperty {
  /**
   * Creates an instance of Animation.
   * @param {animation} animation - The properties of the animation.
   * @param {WebGLTF} [root=this] - The root WebGLTF object.
   */
  constructor(animation, root) {
    super(animation, root);

    const { channels, samplers } = animation;

    /**
     * An array of samplers that combines input and output accessors with an interpolation algorithm to define a
     * keyframe graph (but not its target).
     * @type {animationSampler[]}
     */
    this.samplers = samplers.map(sampler => new AnimationSampler(sampler, root));

    /**
     * An array of channels, each of which targets an animation's sampler at a node's property. Different channels of
     * the same animation can't have equal targets.
     * @type {channel[]}
     */
    this.channels = channels.map(channel => new Channel(channel, this, root));
  }
}

export default Animation;
