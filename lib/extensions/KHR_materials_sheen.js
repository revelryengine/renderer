import { extensions   } from '../extensions.js';
import { GLTFProperty } from '../gltf-property.js';
import { TextureInfo  } from '../texture-info.js';

/**
 * https://github.com/sebavan/glTF/tree/KHR_materials_sheen/extensions/2.0/Khronos/KHR_materials_sheen
 */

/**
 * KHR_materials_sheen material extension
 * @typedef {glTFProperty} khrMaterialsSheenMaterial
 * @property {Number} [intensityFactor=0] - The sheen layer intensity of the material. A value of 0.0 means the material has no sheen layer enabled.
 * @property {Number[]} [colorFactor=[1,1,1]] - Color of the sheen layer.
 * @property {textureInfo} [colorIntensityTexture] - The sheen layer texture. Stored in channel RGB the sheen color in sRGB transfer function and in A the intensity linear factor.
 */

 /**
  * A class wrapper for the material khrMaterialsSheenMaterial object.
  */
export class KHRMaterialsSheenMaterial extends GLTFProperty {
  /**
   * Creates an instance of KHRMaterialsSheenMaterial.
   * @param {khrMaterialsSheenMaterial} khrMaterialsSheenMaterial - The properties of the KHR_materials_sheen material extension.
   */
  constructor(khrMaterialsSheenMaterial) {
    super(khrMaterialsSheenMaterial);

    const { intensityFactor = 0, colorFactor = [1, 1, 1], colorIntensityTexture } = khrMaterialsSheenMaterial;

    /**
     * The sheen layer intensity of the material. A value of 0.0 means the material has no sheen layer enabled.
     * @type {Number}
     */
    this.intensityFactor = intensityFactor;

    /**
     * Color of the sheen layer.
     * @type {Number[]}
     */
    this.colorFactor = colorFactor;

    /**
     * The sheen layer texture. Stored in channel RGB the sheen color in sRGB transfer function and in A the intensity linear factor.
     * @type {TextureInfo}
     */
    this.colorIntensityTexture = colorIntensityTexture ? new TextureInfo(colorIntensityTexture) : undefined;
  }

  /**
   * Dereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  dereference(root) {
    if (this.colorIntensityTexture) this.colorIntensityTexture.dereference(root);
    super.dereference(root);
  }

  /**
   * Rereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  rereference(root) {
    if (this.colorIntensityTexture) this.colorIntensityTexture.rereference(root);
    super.rereference(root);
  }
}

extensions.set('KHR_materials_sheen', {
  schema: {
    Material: KHRMaterialsSheenMaterial,
  },
});
