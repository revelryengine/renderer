import { GLTFProperty } from './gltf-property.js';
import { Target       } from './target.js';

/**
 * Targets an animation's sampler at a node's property.
 * @typedef {glTFProperty} channel
 * @property {Number} sampler - The index of a sampler in this animation used to compute the value for the target.
 * @property {Object} target - The index of the node and TRS property to target.
 *
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#channel
 */


/**
 * A class wrapper around the glTF channel object.
 */
export class Channel extends GLTFProperty {
  /**
   * Creates an instance of Channel.
   * @param {channel} channel - The properties of the channel.
   * @param {Animation} animation - The animation to get sampler from.
   * @param {WebGLTF} [root=this] - The root WebGLTF object.
   */
  constructor(channel, animation, root) {
    super(channel, root);

    const { sampler, target } = channel;

    /**
     * The Sampler in this animation used to compute the value for the target.
     * @type {AnimationSampler}
     */
    this.sampler = animation.samplers[sampler];

    /**
     * The Node and TRS property to target.
     * @type {Target}
     */
    this.target = new Target(target, root);

    Object.defineProperty(this, '$animation', { value: animation });
  }

  /**
   * Re-references any glTF index properties.
   */
  toJSON() {
    return {
      ...this,
      sampler: this.$animation.samplers.indexOf(this.sampler),
    };
  }
}

export default Channel;
