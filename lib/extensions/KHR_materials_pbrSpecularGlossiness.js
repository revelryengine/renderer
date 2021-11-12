import { extensions   } from '../extensions.js';
import { GLTFProperty } from '../gltf-property.js';
import { TextureInfo  } from '../texture-info.js';

/**
* @see https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_pbrSpecularGlossiness
*/


/**
* KHR_materials_pbrSpecularGlossiness material extension
* @typedef {glTFProperty} khrMaterialsPBRSpecularGlossinessMaterial
* @property {Number[]} [diffuseFactor=[1,1,1,1]] - The reflected diffuse factor of the material.
* @property {Number[]} [specularFactor=[1,1,1]] - The specular RGB color of the material.
* @property {Number} [glossinessFactor=1] - The glossiness or smoothness of the material.
* @property {textureInfo} [diffuseTexture] - The diffuse texture.
* @property {textfureInfo} [specularGlossinessTexture] - The specular-glossiness texture.
*/

/**
* A class wrapper for the material khrMaterialsPBRSpecularGlossinessMaterial object.
*/
export class KHRMaterialsPBRSpecularGlossinessMaterial extends GLTFProperty {
    /**
    * Creates an instance of KHRMaterialsPBRSpecularGlossinessMaterial.
    * @param {khrMaterialsPBRSpecularGlossinessMaterial} khrMaterialsPBRSpecularGlossinessMaterial - The properties of the KHR_materials_pbrSpecularGlossiness material extension.
    */
    constructor(khrMaterialsPBRSpecularGlossinessMaterial) {
        super(khrMaterialsPBRSpecularGlossinessMaterial);
        
        const {
            diffuseFactor = [1, 1, 1, 1], specularFactor = [1, 1, 1], glossinessFactor = 1,
            diffuseTexture, specularGlossinessTexture,
        } = khrMaterialsPBRSpecularGlossinessMaterial;
        
        /**
        * The RGBA components of the reflected diffuse color of the material. Metals have a diffuse value of
        * `[0.0, 0.0, 0.0]`. The fourth component (A) is the alpha coverage of the material. The `alphaMode` property
        * specifies how alpha is interpreted. The values are linear.
        * @type {Number[]}
        */
        this.diffuseFactor = diffuseFactor;
        
        /**
        * The specular RGB color of the material. This value is linear.
        * @type {Number[]}
        */
        this.specularFactor = specularFactor;
        
        /**
        * The glossiness or smoothness of the material. A value of 1.0 means the material has full glossiness or is
        * perfectly smooth. A value of 0.0 means the material has no glossiness or is completely rough. This value is linear.
        * @type {Number}
        */
        this.glossinessFactor = glossinessFactor;
        
        /**
        * The diffuse texture. This texture contains RGB components of the reflected diffuse color of the material encoded
        * with the sRGB transfer function. If the fourth component (A) is present, it represents the linear alpha coverage
        * of the material. Otherwise, an alpha of 1.0 is assumed. The `alphaMode` property specifies how alpha is interpreted.
        * The stored texels must not be premultiplied.
        * @type {TextureInfo}
        */
        this.diffuseTexture = diffuseTexture ? new TextureInfo(diffuseTexture) : undefined;
        
        /**
        * The specular-glossiness texture is an RGBA texture, containing the specular color (RGB) encoded with the sRGB
        * transfer function and the linear glossiness value (A).
        * @type {TextureInfo}
        */
        this.specularGlossinessTexture = specularGlossinessTexture ? new TextureInfo(specularGlossinessTexture) : undefined;
    }
    
    static referenceFields = [
        { name: 'diffuseTexture',            type: 'sub', assign: { sRGB: true } },
        { name: 'specularGlossinessTexture', type: 'sub', assign: { sRGB: true } },
    ];
    
    static textureFields = ['diffuseTexture', 'specularGlossinessTexture'];
    static uniformFields = { 
        diffuseFactor:    'u_DiffuseFactor',
        specularFactor:   'u_SpecularFactor',
        glossinessFactor: 'u_GlossinessFactor',
    }
    
    static defines = { MATERIAL_SPECULARGLOSSINESS: 1, MATERIAL_METALLICROUGHNESS: null };
}

extensions.set('KHR_materials_pbrSpecularGlossiness', {
    schema: {
        Material: KHRMaterialsPBRSpecularGlossinessMaterial,
    },
});
