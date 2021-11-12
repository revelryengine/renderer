import { extensions   } from '../extensions.js';
import { GLTFProperty } from '../gltf-property.js';
import { TextureInfo  } from '../texture-info.js';

/**
* @see https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_sheen
*/

/**
* KHR_materials_sheen material extension
* @typedef {glTFProperty} khrMaterialsSheenMaterial
* @property {Number[]} [sheenColorFactor=[0,0,0]] - The sheen color in linear space.
* @property {textureInfo} [sheenColorTexture] - The sheen color (RGB) texture.
* @property {Number} [sheenRoughnessFactor=0] - The sheen roughness.
* @property {textureInfo} [sheenRoughnessTexture] - The sheen roughness (Alpha) texture.
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
        
        const { sheenColorFactor = [0, 0, 0], sheenColorTexture, sheenRoughnessFactor = 0, sheenRoughnessTexture } = khrMaterialsSheenMaterial;
        
        /**
        * The sheen color in linear space.
        * @type {Number[]}
        */
        this.sheenColorFactor = sheenColorFactor;
        
        /**
        * The sheen color (RGB) texture.
        * @type {TextureInfo}
        */
        this.sheenColorTexture = sheenColorTexture ? new TextureInfo(sheenColorTexture) : undefined;
        
        /**
        * The sheen color in linear space.
        * @type {Number}
        */
        this.sheenRoughnessFactor = sheenRoughnessFactor;
        
        /**
        * The sheen roughness (Alpha) texture.
        * @type {TextureInfo}
        */
        this.sheenRoughnessTexture = sheenRoughnessTexture ? new TextureInfo(sheenRoughnessTexture) : undefined;
    }
    
    static referenceFields = [
        { name: 'sheenColorTexture',     type: 'sub', assign: { sRGB: true } },
        { name: 'sheenRoughnessTexture', type: 'sub', assign: { sRGB: true } },
    ];
    
    static textureFields = ['sheenColorTexture', 'sheenRoughnessTexture'];
    static uniformFields = { 
        sheenColorFactor:     'u_SheenColorFactor',
        sheenRoughnessFactor: 'u_SheenRoughnessFactor',
    }
    
    static defines = { MATERIAL_SHEEN: 1 };
}

extensions.set('KHR_materials_sheen', {
    schema: {
        Material: KHRMaterialsSheenMaterial,
    },
});
