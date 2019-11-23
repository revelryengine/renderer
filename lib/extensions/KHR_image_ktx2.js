import { extensions   } from '../extensions.js';
import { GLTFProperty } from '../gltf-property.js';

/**
 * @see https://github.com/KhronosGroup/glTF/tree/khr_ktx2_ibl/extensions/2.0/Khronos/KHR_image_ktx2
 */

/**
 * @typedef {Object} khrImageKTX2ImageLevel
 * @property {Number} byteOffset
 * @property {Number} byteLength
 * @property {Number} [uncompressedByteLength]
 */

/**
 * @typedef {Object} khrImageKTX2ImageMetadata
 * @property {Number} KTXcubemapIncomplete
 * @property {String} KTXorientation
 * @property {Number[]} KTXglFormat
 * @property {Number} KTXdxgiFormat__
 * @property {Number} KTXmetalPixelFormat
 * @property {String} KTXswizzle
 * @property {String} KTXwriter
 * @property {Boolean} KTXastcDecodeRGB9E5
 */


/**
 * KHR_image_ktx2 image extension
 * @typedef {glTFProperty} khrImageKTX2Image
 * @property {Number} [vkFormat=0]
 * @property {Number} pixelWidth
 * @property {Number} [pixelHeight=0]
 * @property {Number} [pixelDepth=0]
 * @property {Number} [layerCount=0]
 * @property {Number} [faceCount=1]
 * @property {Number} [supercompressionScheme=0]
 * @property {Number} dfdByteOffset
 * @property {Number} dfdByteLength
 * @property {Number} [sgdByteOffset=0]
 * @property {Number} [sgdByteLength=0]
 * @property {Boolean} [generateMipmaps=false]
 * @property {khrImageKTX2ImageLevel[]} levels
 * @property {khrImageKTX2ImageMetadata} metadata
 */

 /**
  * A class wrapper for the image khrImageKTX2Image object.
  */
export class KHRImageKTX2Image extends GLTFProperty {
  /**
   * Creates an instance of KHRImageKTX2Image.
   * @param {khrImageKTX2Image} khrImageKTX2Image - The properties of the KHR_image_ktx2 image extension.
   */
  constructor(khrImageKTX2Image) {
    super(khrImageKTX2Image);

    const { vkFormat = 0, pixelWidth, pixelHeight = 0, pixelDepth = 0, layerCount = 0, faceCount = 1 } = khrImageKTX2Image;
    const { supercompressionScheme = 0, dfdByteOffset, dfdByteLength, sgdByteOffset = 0, sgdByteLength = 0 } = khrImageKTX2Image;
    const { generateMipmaps = false, levels, metadata } = khrImageKTX2Image;

    /**
     * @type {Number}
     */
    this.vkFormat = vkFormat;

    /**
     * @type {Number}
     */
    this.pixelWidth = pixelWidth;

    /**
     * @type {Number}
     */
    this.pixelHeight = pixelHeight;

    /**
     * @type {Number}
     */
    this.pixelDepth = pixelDepth;

    /**
     * @type {Number}
     */
    this.layerCount = layerCount;

    /**
     * @type {Number}
     */
    this.faceCount = faceCount;

    /**
     * @type {Number}
     */
    this.supercompressionScheme = supercompressionScheme;

    /**
     * @type {Number}
     */
    this.dfdByteOffset = dfdByteOffset;

    /**
     * @type {Number}
     */
    this.dfdByteLength = dfdByteLength;

    /**
     * @type {Number}
     */
    this.sgdByteOffset = sgdByteOffset;

    /**
     * @type {Number}
     */
    this.sgdByteLength = sgdByteLength;

    /**
     * @type {Boolean}
     */
    this.generateMipmaps = generateMipmaps;

    /**
     * @type {khrImageKTX2ImageLevel[]}
     */
    this.levels = levels;

    /**
     * @type {khrImageKTX2ImageMetadata}
     */
    this.metadata = metadata;
  }
}

extensions.set('KHR_image_ktx2', {
  schema: {
    Image: KHRImageKTX2Image,
  },
});
