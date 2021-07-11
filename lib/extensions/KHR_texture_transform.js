import { extensions   } from '../extensions.js';
import { GLTFProperty } from '../gltf-property.js';
import { glMatrix     } from '../webgltf.js';

const { mat3 } = glMatrix;

/**
 * @see https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_texture_transform
 */


/**
 * KHR_texture_transform textureInfo extension
 * @typedef {glTFProperty} khrTextureTransform
 * @property {Number[]} [offset=[0,0]] - The offset of the UV coordinate origin as a factor of the texture dimensions.
 * @property {Number} [rotation=0] - Rotate the UVs by this many radians counter-clockwise around the origin.
 * @property {Number[]} [scale=[1,1]] - The scale factor applied to the components of the UV coordinates.
 * @property {Number} [texCoord] - Overrides the textureInfo texCoord value if supplied, and if this extension is supported.
 */

/**
  * A class wrapper for the textureInfo khrTextureTransform object.
  */
export class KHRTextureTransform extends GLTFProperty {
  /**
   * Creates an instance of KHRTextureTransform.
   * @param {khrTextureTransform} khrTextureTransform - The properties of the KHR_texture_transform textureInfo extension.
   */
  constructor(khrTextureTransform) {
    super(khrTextureTransform);
    const { offset = [0, 0], rotation = 0, scale = [1, 1], texCoord } = khrTextureTransform;

    /**
     * The offset of the UV coordinate origin as a factor of the texture dimensions.
     * @type {Number[]}
     */
    this.offset = offset;

    /**
     * Rotate the UVs by this many radians counter-clockwise around the origin.
     * @type {Number}
     */
    this.rotation = rotation;

    /**
     * The scale factor applied to the components of the UV coordinates.
     * @type {Number[]}
     */
    this.scale = scale;

    /**
     * Overrides the textureInfo texCoord value if supplied, and if this extension is supported.
     * @type {Number}
     */
    this.texCoord = texCoord;
  }

  getTransform() {
    const s = Math.sin(this.rotation);
    const c = Math.cos(this.rotation);

    const rotation = mat3.fromValues(
      c, -s, 0.0,
      s, c, 0.0,
      0.0, 0.0, 1.0
    );

    const scale = mat3.fromValues(
      this.scale[0], 0, 0,
      0, this.scale[1], 0,
      0, 0, 1
    );

    const translation = mat3.fromValues(
      1, 0, 0, 
      0, 1, 0, 
      this.offset[0], this.offset[1], 1
    );

    const uvMatrix = mat3.create();
    mat3.multiply(uvMatrix, translation, rotation);
    mat3.multiply(uvMatrix, uvMatrix, scale);
    return uvMatrix;
  }

  applyTextureTransform(program, uniformName) {
    const { texCoord } = this;
    if(texCoord !== undefined) program.uniforms.set(`${uniformName}UVSet`, texCoord);
    program.uniforms.set(`${uniformName}UVTransform`, this.getTransform());
  }
}

extensions.set('KHR_texture_transform', {
  schema: {
    TextureInfo:          KHRTextureTransform,
    NormalTextureInfo:    KHRTextureTransform,
    OcclusionTextureInfo: KHRTextureTransform,
  },
});
