import { extensions   } from '../extensions.js';
import { GLTFProperty } from '../gltf-property.js';
import { TextureInfo  } from '../texture-info.js';

/**
 * @see https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_specular
 */

/**
 * KHR_materials_specular material extension
 * @typedef {glTFProperty} khrMaterialsSpecularMaterial
 * @property {Number} [specularFactor=1] - The strength of the specular reflection.
 * @property {textureInfo} [specularTexture] - A texture that defines the strength of the specular reflection, stored in the alpha (A) channel. This will be multiplied by specularFactor.
 * @property {Number[]} [specularColorFactor=[1,1,1]] - The F0 color of the specular reflection (linear RGB).
 * @property {textureInfo} [specularColorTexture] - A texture that defines the F0 color of the specular reflection, stored in the RGB channels and encoded in sRGB. This texture will be multiplied by specularColorFactor.
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

    const { specularFactor = 1, specularTexture, specularColorFactor = [1, 1, 1], specularColorTexture } = khrMaterialsSpecularMaterial;

    /**
     * The specular channel.
     * @type {Number}
     */
    this.specularFactor = specularFactor;


    /**
     * A texture that defines the strength of the specular reflection, stored in the alpha (A) channel. This will be multiplied by specularFactor.
     * @type {TextureInfo}
     */
    this.specularTexture = specularTexture ? new TextureInfo(specularTexture) : undefined;

    /**
     * The F0 color of the specular reflection (linear RGB).
     * @type {Number[]}
     */
    this.specularColorFactor = specularColorFactor;

    /**
     * A texture that defines the F0 color of the specular reflection, stored in the RGB channels and encoded in sRGB. This texture will be multiplied by specularColorFactor.
     * @type {TextureInfo}
     */
    this.specularColorTexture = specularColorTexture ? new TextureInfo(specularColorTexture) : undefined;
  }

  static referenceFields = [
    { name: 'specularTexture', type: 'sub' },
    { name: 'specularColorTexture', type: 'sub' },
  ];

  defineMaterial(PBRProgram, defines) {
    defines['MATERIAL_SPECULAR'] = 1;

    if(this.specularTexture) PBRProgram.defineTexture(defines, this.specularTexture, 'specularTexture');
    if(this.specularColorTexture) PBRProgram.defineTexture(defines, this.specularColorTexture, 'specularColorTexture');
  }

  applyMaterial(program, context) {
    if(this.specularTexture) program.applyTexture(context, this.specularTexture, 'specularTexture');
    if(this.specularColorTexture) program.applyTexture(context, this.specularColorTexture, 'specularColorTexture');

    program.uniforms.set('u_KHR_materials_specular_specularFactor', this.specularFactor);
    program.uniforms.set('u_KHR_materials_specular_specularColorFactor', this.specularColorFactor);
  }
}

extensions.set('KHR_materials_specular', {
  schema: {
    Material: KHRMaterialsSpecularMaterial,
  },
});
