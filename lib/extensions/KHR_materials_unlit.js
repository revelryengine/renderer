import { extensions   } from '../extensions.js';
import { GLTFProperty } from '../gltf-property.js';

/**
 * https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_unlit
 */


/**
 * KHR_materials_unlit material extension
 * @typedef {glTFProperty} khrMaterialsUnlitMaterial
 */

 /**
  * A class wrapper for the material khrMaterialsUnlitMaterial object.
  */
export class KHRMaterialsUnlitMaterial extends GLTFProperty {
  /**
   * Creates an instance of KHRMaterialsUnlitMaterial.
   * @param {khrMaterialsUnlitMaterial} khrMaterialsUnlitMaterial - The properties of the KHR_materials_unlit material extension.
   */
  constructor(khrMaterialsUnlitMaterial) {
    super(khrMaterialsUnlitMaterial);
  }
}

extensions.set('KHR_materials_unlit', {
  schema: {
    Material: KHRMaterialsUnlitMaterial,
  },
});
