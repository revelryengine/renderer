import { extensions   } from '../extensions.js';
import { GLTFProperty } from '../gltf-property.js';
import { TextureInfo  } from '../texture-info.js';

/**
 * @see https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_volume
 */

/**
 * KHR_materials_volume material extension
 * @typedef {glTFProperty} khrMaterialsVolumeMaterial
 * @property {Number} [thicknessFactor=0] - The thickness of the volume beneath the surface. The value is given in the coordinate space of the mesh. If the value is 0 the material is thin-walled. Otherwise the material is a volume boundary. The doubleSided property has no effect on volume boundaries.
 * @property {textureInfo} [thicknessTexture] - A texture that defines the thickness, stored in the G channel. This will be multiplied by thicknessFactor.
 * @property {Number} [attenuationDistance=Infinity] - Density of the medium given as the average distance that light travels in the medium before interacting with a particle. The value is given in world space.
 * @property {Number[]} [attenuationColor=[1,1,1]] - The color that white light turns into due to absorption when reaching the attenuation distance.
 */

/**
 * A class wrapper for the material khrMaterialsVolumeMaterial object.
 */
export class KHRMaterialsVolumeMaterial extends GLTFProperty {
  /**
   * Creates an instance of KHRMaterialsVolumeMaterial.
   * @param {khrMaterialsVolumeMaterial} khrMaterialsVolumeMaterial - The properties of the KHR_materials_volume material extension.
   */
  constructor(khrMaterialsVolumeMaterial) {
    super(khrMaterialsVolumeMaterial);

    const { thicknessFactor = 0, thicknessTexture, attenuationDistance, attenuationColor = [1, 1, 1] } = khrMaterialsVolumeMaterial;

    /**
     * The thickness of the volume beneath the surface. The value is given in the coordinate space of the mesh. If the value is 0 the material is thin-walled. Otherwise the material is a volume boundary. The doubleSided property has no effect on volume boundaries.
     * @type {Number}
     */
    this.thicknessFactor = thicknessFactor;


    /**
     * A texture that defines the thickness, stored in the G channel. This will be multiplied by thicknessFactor.
     * @type {TextureInfo}
     */
    this.thicknessTexture = thicknessTexture ? new TextureInfo(thicknessTexture) : undefined;

    /**
     * Density of the medium given as the average distance that light travels in the medium before interacting with a particle. The value is given in world space.
     * @type {Number}
     */
    this.attenuationDistance = attenuationDistance;

    /**
     * The color that white light turns into due to absorption when reaching the attenuation distance.
     * @type {Number[]}
     */
    this.attenuationColor = attenuationColor;
  }

  static referenceFields = [
    { name: 'thicknessTexture', type: 'sub' },
  ];

  defineMaterial(PBRProgram, defines) {
    defines['MATERIAL_VOLUME'] = 1;

    if(this.thicknessTexture) PBRProgram.defineTexture(defines, this.thicknessTexture, 'thicknessTexture');
  }

  applyMaterial(program, context) {
    if(this.thicknessTexture) program.applyTexture(context, this.thicknessTexture, 'thicknessTexture');

    program.uniforms.set('u_ThicknessFactor',     this.thicknessFactor);
    program.uniforms.set('u_AttenuationDistance', this.attenuationDistance);
    program.uniforms.set('u_AttenuationColor',    this.attenuationColor);
  }
}

extensions.set('KHR_materials_volume', {
  schema: {
    Material: KHRMaterialsVolumeMaterial,
  },
});
