import { extensions   } from '../extensions.js';
import { GLTFProperty } from '../gltf-property.js';
import { TextureInfo  } from '../texture-info.js';

/**
 * https://github.com/ux3d/glTF/tree/KHR_materials_pbrClearcoat/extensions/2.0/Khronos/KHR_materials_specular
 */

/**
 * KHR_materials_specular material extension
 * @typedef {glTFProperty} khrMaterialsSpecularMaterial
 * @property {Number} [specularFactor=0.5] - The specular channel.
 * @property {textureInfo} [specularTexture] - The specular channel texture. Stored in channel A with default linear value 1.0 of the AO-Roughness-Metallic texture.
 */

 /**
  * A class wrapper for the material khrMaterialsSpecularMaterial object.
  */
export class KHRMaterialsSpecularMaterial extends GLTFProperty {
  /**
   * Creates an instance of KHRMaterialsSpecularMaterial.
   * @param {khrMaterialsSpecularMaterial} khrMaterialsSpecularMaterial - The properties of the KHR_materials_specular material extension.
   */
  constructor(khrMaterialsSpecularMaterial) {
    super(khrMaterialsSpecularMaterial);

    const { specularFactor = 0.5, specularTexture } = khrMaterialsSpecularMaterial;

    /**
     * The specular channel.
     * @type {Number}
     */
    this.specularFactor = specularFactor;


    /**
     * The specular channel texture. Stored in channel A with default linear value 1.0 of the AO-Roughness-Metallic texture.
     * @type {TextureInfo}
     */
    this.specularTexture = specularTexture ? new TextureInfo(specularTexture) : undefined;
  }

  /**
   * Dereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  dereference(root) {
    if (this.specularTexture) this.specularTexture.dereference(root);
    super.dereference(root);
  }

  /**
   * Rereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  rereference(root) {
    if (this.specularTexture) this.specularTexture.rereference(root);
    super.rereference(root);
  }
}

extensions.set('KHR_materials_specular', {
  schema: {
    Material: KHRMaterialsSpecularMaterial,
  },
});
