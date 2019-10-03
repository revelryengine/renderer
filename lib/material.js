import { NamedGLTFProperty    } from './gltf-property.js';
import { PBRMetallicRoughness } from './pbr-metallic-roughness.js';
import { NormalTextureInfo    } from './normal-texture-info.js';
import { OcclusionTextureInfo } from './occlusion-texture-info.js';
import { TextureInfo          } from './texture-info.js';

/**
 * The material appearance of a primitive.
 * @typedef {namedGLTFProperty} material
 * @property {pbrMetallicRoughness} [pbrMetallicRoughness] - A set of parameter values that are used to define the
 * metallic-roughness material model from Physically-Based Rendering (PBR) methodology. When not specified, all the
 * default values of {@link pbrMetallicRoughness} apply.
 * @property {normalTextureInfo} [normalTexture] - The normal map texture.
 * @property {occlusionTextureInfo} [occlusionTexture] - The occlusion map texture.
 * @property {textureInfo} [emissiveTexture] - The emissive map texture.
 * @property {Number[]} [emissiveFactor=[0,0,0]] - The emissive color of the material.
 * @property {String} [alphaMode="OPAQUE"] - The alpha rendering mode of the material.
 * @property {Number} [alphaCutoff=0.5] - The alpha cutoff value of the material.
 * @property {Boolean} [doubleSided=false] - Specifies whether the material is double sided.
 *
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#material
 */

/**
 * A class wrapper around the glTF material object.
 */
export class Material extends NamedGLTFProperty {
  /**
   * Creates an instance of Material.
   * @param {material} material - The properties of the material.
   */
  constructor(material) {
    super(material);

    const {
      pbrMetallicRoughness, normalTexture, occlusionTexture, emissiveTexture, emissiveFactor = [0, 0, 0],
      alphaMode = 'OPAQUE', alphaCutoff = 0.5, doubleSided = false,
    } = material;

    /**
     * A set of parameter values that are used to define the
     * metallic-roughness material model from Physically-Based Rendering (PBR) methodology. When not specified, all the
     * default values of {@link pbrMetallicRoughness} apply.
     * @type {pbrMetallicRoughness}
     */
    this.pbrMetallicRoughness = new PBRMetallicRoughness(pbrMetallicRoughness || {});

    /**
     * The normal map texture.
     * @type {NormalTextureInfo}
     */
    this.normalTexture = normalTexture ? new NormalTextureInfo(normalTexture) : undefined;

    /**
     * The occlusion map texture.
     * @type {OcclusionTextureInfo}
     */
    this.occlusionTexture = occlusionTexture ? new OcclusionTextureInfo(occlusionTexture) : undefined;
    /**
     * The emissive map texture.
     * @type {TextureInfo}
     */
    this.emissiveTexture = emissiveTexture ? new TextureInfo(emissiveTexture) : undefined;

    /**
     * The emissive color of the material.
     * @type {Number[]}
     */
    this.emissiveFactor = emissiveFactor;

    /**
     * The alpha rendering mode of the material.
     * @type {String}
     */
    this.alphaMode = alphaMode;

    /**
     * The alpha cutoff value of the material.
     * @type {Number}
     */
    this.alphaCutoff = alphaCutoff;

    /**
     * Specifies whether the material is double sided.
     * @type {Boolean}
     */
    this.doubleSided = doubleSided;
  }

  /**
   * Dereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  dereference(root) {
    if (this.pbrMetallicRoughness) this.pbrMetallicRoughness.dereference(root);
    if (this.normalTexture) this.normalTexture.dereference(root);
    if (this.occlusionTexture) this.occlusionTexture.dereference(root);
    if (this.emissiveTexture) this.emissiveTexture.dereference(root);
    super.dereference(root);
  }

  /**
   * Rereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  rereference(root) {
    if (this.pbrMetallicRoughness) this.pbrMetallicRoughness.rereference(root);
    if (this.normalTexture) this.normalTexture.rereference(root);
    if (this.occlusionTexture) this.occlusionTexture.rereference(root);
    if (this.emissiveTexture) this.emissiveTexture.rereference(root);
    super.rereference(root);
  }
}

export default Material;
