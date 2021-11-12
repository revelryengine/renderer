import { extensions   } from '../extensions.js';
import { GLTFProperty } from '../gltf-property.js';

/**
* @see https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_ior
*/

/**
* KHR_materials_ior material extension
* @typedef {glTFProperty} khrMaterialsIORMaterial
* @property {Number} [ior=1.5] - The index of refraction.
*/

/**
* A class wrapper for the material khrMaterialsIORMaterial object.
*/
export class KHRMaterialsIORMaterial extends GLTFProperty {
    /**
    * Creates an instance of KHRMaterialsIORMaterial.
    * @param {khrMaterialsIORMaterial} khrMaterialsIORMaterial - The properties of the KHR_materials_ior material extension.
    */
    constructor(khrMaterialsIORMaterial) {
        super(khrMaterialsIORMaterial);
        
        const { ior = 1.5 } = khrMaterialsIORMaterial;
        
        /**
        * The index of refraction.
        * @type {Number}
        */
        this.ior = ior;
    }
    
    static defines = { MATERIAL_IOR: 1 };

    static textureFields = [];
    static uniformFields = { 
        ior: 'u_Ior',
    }
}

extensions.set('KHR_materials_ior', {
    schema: {
        Material: KHRMaterialsIORMaterial,
    },
});
