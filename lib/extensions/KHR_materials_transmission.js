import { extensions   } from '../extensions.js';
import { GLTFProperty } from '../gltf-property.js';
import { TextureInfo  } from '../texture-info.js';

/**
 * @see https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_transmission
 */

/**
 * KHR_materials_transmission material extension
 * @typedef {glTFProperty} khrMaterialsTransmissionMaterial
 * @property {Number} [transmissionFactor=0] - The base percentage of light that is transmitted through the surface.
 * @property {textureInfo} [transmissionTexture] - A texture that defines the transmission percentage of the surface, stored in the R channel. This will be multiplied by transmissionFactor.
 */

 /**
  * A class wrapper for the material khrMaterialsTransmissionMaterial object.
  */
export class KHRMaterialsTransmissionMaterial extends GLTFProperty {
  /**
   * Creates an instance of KHRMaterialsTransmissionMaterial.
   * @param {khrMaterialsTransmissionMaterial} khrMaterialsTransmissionMaterial - The properties of the KHR_materials_transmission material extension.
   */
  constructor(khrMaterialsTransmissionMaterial) {
    super(khrMaterialsTransmissionMaterial);

    const { transmissionFactor = 0, transmissionTexture } = khrMaterialsTransmissionMaterial;

    /**
     * The base percentage of light that is transmitted through the surface.
     * @type {Number}
     */
    this.transmissionFactor = transmissionFactor;


    /**
     * A texture that defines the transmission percentage of the surface, stored in the R channel. This will be multiplied by transmissionFactor.
     * @type {TextureInfo}
     */
    this.transmissionTexture = transmissionTexture ? new TextureInfo(transmissionTexture) : undefined;
  }

  static referenceFields = [
    { name: 'transmissionTexture', type: 'sub' },
  ];

  defineMaterial(PBRProgram, defines) {
    defines['MATERIAL_TRANSMISSION'] = 1;

    if(this.transmissionTexture) PBRProgram.defineTexture(defines, this.transmissionTexture, 'transmissionTexture');
  }

  applyMaterial(program, context, input) {
    if(this.transmissionTexture) program.applyTexture(context, this.transmissionTexture, 'transmissionTexture');
    program.uniforms.set('u_TransmissionFactor', this.transmissionFactor);
  }
}

extensions.set('KHR_materials_transmission', {
  schema: {
    Material: KHRMaterialsTransmissionMaterial,
  },
});
