import { GLTFProperty } from './gltf-property.js';

/**
 * Metadata about the glTF asset.
 * @typedef {glTFProperty} asset
 * @property {String} [copyright] - A copyright message suitable for display to credit the content creator.
 * @property {String} [generator] - Tool that generated this glTF model. Useful for debugging.
 * @property {String} version - The glTF version that this asset targets.
 * @property {string} [minVersion] - The minimum glTF version that this asset targets.
 *
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#asset
 */

/**
 * A class wrapper for glTF asset object.
 */
export class Asset extends GLTFProperty {
  /**
   * Creates an instance of Asset.
   * @param {asset} asset - The properties of the asset.
   */
  constructor(asset) {
    super(asset);

    const { copyright, generator, version, minVersion } = asset;

    /**
     * A copyright message suitable for display to credit the content creator.
     * @type {String}
     */
    this.copyright = copyright;

    /**
     * Tool that generated this glTF model. Useful for debugging.
     * @type {String}
     */
    this.generator = generator;

    /**
     * The glTF version that this asset targets.
     * @type {String}
     */
    this.version = version;

    /**
     * The minimum glTF version that this asset targets.
     * @type {String}
     */
    this.minVersion = minVersion;
  }
}

export default Asset;
