
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
   * @param {WebGLTF} [root=this] - The root WebGLTF object.
   */
  constructor(pbrMetallicRoughness, root) {
    super(pbrMetallicRoughness, root);

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
    this.baseColorTexture = baseColorTexture ? new TextureInfo(baseColorTexture, root) : undefined;

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
      new TextureInfo(metallicRoughnessTexture, root) : undefined;
  }

  /**
   * Dereference glTF index properties.
   */
  dereference() {
    if (this.baseColorTexture) this.baseColorTexture.dereference();
    if (this.metallicRoughnessTexture) this.metallicRoughnessTexture.dereference();
  }

  /**
   * Rereference glTF index properties.
   */
  rereference() {
    if (this.baseColorTexture) this.baseColorTexture.rereference();
    if (this.metallicRoughnessTexture) this.metallicRoughnessTexture.rereference();
  }
}

export default PBRMetallicRoughness;
