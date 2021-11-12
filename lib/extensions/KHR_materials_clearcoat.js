import { extensions   } from '../extensions.js';
import { GLTFProperty } from '../gltf-property.js';
import { TextureInfo  } from '../texture-info.js';

/**
* @see https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_clearcoat
*/

/**
* KHR_materials_clearcoat material extension
* @typedef {glTFProperty} khrMaterialsClearcoatMaterial
* @property {Number} [clearcoatFactor=0] - The clearcoat layer intensity (aka opacity) of the material. A value of 0.0 means the material has no clearcoat layer enabled.
* @property {textureInfo} [clearcoatTexture] - The clearcoat layer intensity texture. Stored in channel R with default linear value 1.0.
* @property {Number} [clearcoatRoughnessFactor=0] - The clearcoat layer roughness of the material.
* @property {textureInfo} [clearcoatRoughnessTexture] - The clearcoat layer roughness texture. Stored in channel G with default linear value 1.0.
* @property {textureInfo} [clearcoatNormalTexture] - A tangent space normal map for the clearcoat layer.
*/

/**
* A class wrapper for the material khrMaterialsClearcoatMaterial object.
*/
export class KHRMaterialsClearcoatMaterial extends GLTFProperty {
    /**
    * Creates an instance of KHRMaterialsClearcoatMaterial.
    * @param {khrMaterialsClearcoatMaterial} khrMaterialsClearcoatMaterial - The properties of the KHR_materials_Clearcoat material extension.
    */
    constructor(khrMaterialsClearcoatMaterial) {
        super(khrMaterialsClearcoatMaterial);
        
        const { clearcoatFactor = 0, clearcoatTexture, clearcoatRoughnessFactor = 0, clearcoatRoughnessTexture, clearcoatNormalTexture } = khrMaterialsClearcoatMaterial;
        
        /**
        * The clearcoat layer intensity (aka opacity) of the material. A value of 0.0 means the material has no clearcoat layer enabled.
        * @type {Number}
        */
        this.clearcoatFactor = clearcoatFactor;
        
        /**
        * The clearcoat layer intensity texture. Stored in channel R with default linear value 1.0.
        * @type {TextureInfo}
        */
        this.clearcoatTexture = clearcoatTexture ? new TextureInfo(clearcoatTexture) : undefined;
        
        /**
        * The clearcoat layer roughness of the material.
        * @type {Number[]}
        */
        this.clearcoatRoughnessFactor = clearcoatRoughnessFactor;
        
        /**
        * The clearcoat layer roughness texture. Stored in channel G with default linear value 1.0.
        * @type {TextureInfo}
        */
        this.clearcoatRoughnessTexture = clearcoatRoughnessTexture ? new TextureInfo(clearcoatRoughnessTexture) : undefined;
        
        /**
        * A tangent space normal map for the clearcoat layer.
        * @type {TextureInfo}
        */
        this.clearcoatNormalTexture = clearcoatNormalTexture ? new TextureInfo(clearcoatNormalTexture) : undefined;
        
    }
    
    static referenceFields = [
        { name: 'clearcoatTexture',          type: 'sub' },
        { name: 'clearcoatRoughnessTexture', type: 'sub' },
        { name: 'clearcoatNormalTexture',    type: 'sub' },
    ];
    
    static textureFields = ['clearcoatTexture', 'clearcoatRoughnessTexture', 'clearcoatNormalTexture'];
    static uniformFields = { 
        clearcoatFactor: 'u_ClearcoatFactor',
        clearcoatRoughnessFactor: 'u_ClearcoatRoughnessFactor'
    }
    
    static defines = { MATERIAL_CLEARCOAT: 1 };
}

extensions.set('KHR_materials_clearcoat', {
    schema: {
        Material: KHRMaterialsClearcoatMaterial,
    },
});
