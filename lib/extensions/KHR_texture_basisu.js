import { extensions   } from '../extensions.js';
import { GLTFProperty } from '../gltf-property.js';

import { LIBKTX } from '../../vendor/libktx.js';

/**
 * @see https://github.com/KhronosGroup/glTF/tree/khr_ktx2_ibl/extensions/2.0/Khronos/KHR_texture_basisu
 */

const GL = WebGLRenderingContext;
const libktx = LIBKTX();

/**
 * KHR_texture_basisu texture extension
 * @typedef {glTFProperty} khrTextureBasisuTexture
 * @property {Number} source - The index of the images node which points to a KTX2 image with Basis Universal supercompression.
 */


/**
 * A class wrapper for the image khrTextureBasisuTexture object.
 */
export class KHRTextureBasisuTexture extends GLTFProperty {
  #lib;
  #failed;

  /**
   * Creates an instance of KHRTextureBasisuTexture.
   * @param {khrTextureBasisuTexture} khrTextureBasisuTexture - The properties of the KHR_texture_basisu texture extension.
   */
  constructor(khrTextureBasisuTexture) {
    super(khrTextureBasisuTexture);

    const { source } = khrTextureBasisuTexture;

    /**
     * The images node or the index of the images node which points to a KTX2 image with Basis Universal supercompression.
     * @type {Number|Image}
     */
    this.source = source;
  }

  static referenceFields = [
    { name: 'source', type: 'collection', collection: 'images' },
  ];

  async load(abortCtrl) {
    super.load(abortCtrl);
    this.#lib = await libktx;
  }

  createWebGLTexture(parent, context) {
    const image = this.source.getImageData();
    if(!image || !this.#lib || this.#failed) return;

    this.#lib.GL.makeContextCurrent(this.#lib.GL.registerContext(context, { majorVersion: 2.0 }));

    const { ktxTexture, TranscodeTarget } = this.#lib;
    try {
      const ktexture = new ktxTexture(image);
      const astcSupported  = !!context.getExtension('WEBGL_compressed_texture_astc');
      const etcSupported   = !!context.getExtension('WEBGL_compressed_texture_etc1');
      const dxtSupported   = !!context.getExtension('WEBGL_compressed_texture_s3tc');
      const pvrtcSupported = !!(context.getExtension('WEBGL_compressed_texture_pvrtc')) || (context.getExtension('WEBKIT_WEBGL_compressed_texture_pvrtc'));
  
      if (ktexture.needsTranscoding) {
        let format;
        if (astcSupported) {
          format = TranscodeTarget.ASTC_4x4_RGBA;
        } else if (dxtSupported) {
          format = TranscodeTarget.BC1_OR_3;
        } else if (pvrtcSupported) {
          format = TranscodeTarget.PVRTC1_4_RGBA;
        } else if (etcSupported) {
          format = TranscodeTarget.ETC;
        } else {
          format = TranscodeTarget.RGBA4444;
        }
        if (ktexture.transcodeBasis(format, 0) != this.#lib.ErrorCode.SUCCESS) {
          throw 'Texture transcode failed.';
        }
      }

      const { target, error, texture } =  ktexture.glUpload();
    
      if (error != context.NO_ERROR) {
        throw 'WebGL error when uploading texture, code = ' + error.toString(16);
      }
      if (texture === undefined) {
        throw 'Texture upload failed.';
      }

      context.bindTexture(target, texture);

      const {
        sampler: {
          wrapS = GL.CLAMP_TO_EDGE,
          wrapT = GL.CLAMP_TO_EDGE,
          minFilter = GL.LINEAR_MIPMAP_LINEAR,
          magFilter = GL.LINEAR
        } = {},
      } = parent;
    
      context.texParameteri(target, GL.TEXTURE_WRAP_S, wrapS);
      context.texParameteri(target, GL.TEXTURE_WRAP_T, wrapT);
      context.texParameteri(target, GL.TEXTURE_MIN_FILTER, minFilter);
      context.texParameteri(target, GL.TEXTURE_MAG_FILTER, magFilter);

      context.pixelStorei(GL.UNPACK_FLIP_Y_WEBGL, false);
      context.pixelStorei(GL.UNPACK_COLORSPACE_CONVERSION_WEBGL, GL.NONE);

      ktexture.delete();
      return texture;
    } catch(e) {
      console.warn('Failed to load KTX2 texture', this);
      this.#failed = true;
    }
  }
}

extensions.set('KHR_texture_basisu', {
  schema: {
    Texture: KHRTextureBasisuTexture,
  },
});
