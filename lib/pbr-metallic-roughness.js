
import { GLTFProperty } from './gltf-property.js';
import { TextureInfo  } from './texture-info.js';

/**
 * A set of parameter values that are used to define the metallic-roughness material model from Physically-Based
 * Rendering (PBR) methodology.
 * @typedef {glTFProperty} pbrMetallicRoughness
 * @property {Number[]} [baseColorFactor=[1,1,1,1]] - The material's base color factor.
 * @property {texture} [baseColorTexture] - The base color texture.
 * @property {Number} [metallicFactor=1] - The metalness of the material.
 * @property {Number} [roughnessFactor=1] - The roughness of the material.
 * @property {texture} [metallicRoughnessTexture] - The metallic-roughness texture.
 *
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#pbrmetallicroughness
 */

/**
 * A class wrapper around the glTF pbrMetallicRoughness object.
 */
export class PBRMetallicRoughness extends GLTFProperty {
  /**
   * Creates an instance of PBRMetallicRoughness.
   * @param {pbrMetallicRoughness} pbrMetallicRoughness - The properties of the pbrMetallicRoughness.
   */
  constructor(pbrMetallicRoughness = {}) {
    super(pbrMetallicRoughness);

    const {
      baseColorFactor = [1, 1, 1, 1], baseColorTexture,
      metallicFactor = 1, roughnessFactor = 1, metallicRoughnessTexture,
    } = pbrMetallicRoughness;

    /**
     * The material's base color factor.
     * @type {Number}
     */
    this.baseColorFactor = baseColorFactor;

    /**
     * The base color texture.
     * @type {Texture}
     */
    this.baseColorTexture = baseColorTexture ? new TextureInfo(baseColorTexture) : undefined;

    /**
     * The metalness of the material.
     * @type {Number}
     */
    this.metallicFactor = metallicFactor;

    /**
     * The roughness of the material.
     * @type {Number}
     */
    this.roughnessFactor = roughnessFactor;

    /**
     * The metallic-roughness texture.
     * @type {Texture}
     */
    this.metallicRoughnessTexture = metallicRoughnessTexture ?
      new TextureInfo(metallicRoughnessTexture) : undefined;
  }

  static referenceFields = [
    { name: 'baseColorTexture',         type: 'sub', assign: { sRGB: true } },
    { name: 'metallicRoughnessTexture', type: 'sub' },
  ];
}

export default PBRMetallicRoughness;
