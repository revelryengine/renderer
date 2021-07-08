import { NamedGLTFProperty } from './gltf-property.js';

/**
 * A texture and its sampler.
 * @typedef {namedGLTFProperty} texture
 * @property {Number} [sampler] - The index of the sampler used by this texture. When undefined, a sampler with repeat
 *  wrapping and auto filtering should be used.
 * @property {Number} [source] - The index of the image used by this texture.
 *
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#texture
 */

const GL = WebGLRenderingContext;
const MIPMAP_FILTERS = new Set([
  GL.NEAREST_MIPMAP_NEAREST,
  GL.NEAREST_MIPMAP_LINEAR,
  GL.LINEAR_MIPMAP_NEAREST,
  GL.LINEAR_MIPMAP_LINEAR,
]);

const REPEAT_WRAPS = new Set([
  GL.REPEAT,
  GL.MIRRORED_REPEAT,
]);

function isPowerOf2(n) {
  return n && (n & (n - 1)) === 0;
}

function nearestUpperPowerOf2(v) {
  let x = v - 1;
  x |= x >> 1;
  x |= x >> 2;
  x |= x >> 4;
  x |= x >> 8;
  x |= x >> 16;
  x += 1;
  return x;
}

function resizeImage(image) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const width = nearestUpperPowerOf2(image.width);
  const height = nearestUpperPowerOf2(image.height);

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

function normalizeImage(image, minFilter, wrapS, wrapT) {
  if ((MIPMAP_FILTERS.has(minFilter) || REPEAT_WRAPS.has(wrapS) || REPEAT_WRAPS.has(wrapT))
    && !isPowerOf2(image.width)) {
    return resizeImage(image);
  }
  return image;
}

/**
 * A class wrapper around the glTF texture object.
 */
export class Texture extends NamedGLTFProperty {
  /**
   *  Cache of WebGL textures keyed by context.
   */ 
  #cache = new WeakMap();

  /**
   * Boolean to indicate that texture uses sRGB transfer function 
   * @see https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#metallic-roughness-material
   */ 
  #sRGB = false;


  /**
   * Creates an instance of Texture.
   * @param {texture} texture - The properties of the texture.
   */
  constructor(texture) {
    super(texture);

    const { sampler, source } = texture;

    /**
     * The Sampler or the index of the Sampler used by this texture. When undefined, a sampler with repeat wrapping and
     * auto filtering should be used.
     * @type {Number|Sampler}
     */
    this.sampler = sampler;

    /**
     * The Image or the index of the Image used by this texture.
     * @type {Number|Image}
     */
    this.source = source;
  }

  static referenceFields = [
    { name: 'sampler', type: 'collection', collection: 'samplers' },
    { name: 'source',  type: 'collection', collection: 'images' },
  ];

  /**
   * Set this to true indicate that texture uses sRGB transfer function 
   * @see https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#metallic-roughness-material
   */ 
  set sRGB(v) {
    this.#sRGB = v;
  }

  /**
   * Creates the texture in a WebGL context.
   * @param {WebGLRenderingContext} context - The WebGL context.
   * @param {Number} [target=WebGLRenderingContext.TEXTURE_2D] - The target to create the texture for.
   */
  createWebGLTexture(context, target = GL.TEXTURE_2D) {
    let texture = this.#cache.get(context);
    if (texture) return texture;

    // Check if any extensions want to create the texture instead
    for(const ext in this.extensions) {
      if(this.extensions[ext].createWebGLTexture) {
        texture = this.extensions[ext].createWebGLTexture(this, context, target);
        this.#cache.set(context, texture);
        return texture;
      }
    }

    const {
      source,
      sampler: {
        wrapS = GL.REPEAT,
        wrapT = GL.REPEAT,
        minFilter = GL.LINEAR_MIPMAP_LINEAR,
        magFilter = GL.LINEAR
      } = {},
    } = this;

    const image = source && source.getImageData();

    if (!image) return;

    texture = context.createTexture();

    context.bindTexture(target, texture);

    context.texParameteri(target, GL.TEXTURE_WRAP_S, wrapS);
    context.texParameteri(target, GL.TEXTURE_WRAP_T, wrapT);
    context.texParameteri(target, GL.TEXTURE_MIN_FILTER, minFilter);
    context.texParameteri(target, GL.TEXTURE_MAG_FILTER, magFilter);

    context.pixelStorei(GL.UNPACK_FLIP_Y_WEBGL, false);
    context.pixelStorei(GL.UNPACK_COLORSPACE_CONVERSION_WEBGL, GL.NONE);

    const format = context.SRGB8_ALPHA8 && this.#sRGB ? context.SRGB8_ALPHA8 : GL.RGBA;
    context.texImage2D(target, 0, format, GL.RGBA, GL.UNSIGNED_BYTE, normalizeImage(image, minFilter, wrapS, wrapT));
    if (MIPMAP_FILTERS.has(minFilter)) {
      context.generateMipmap(target);
    }

    const ext = context.glExtensions?.EXT_texture_filter_anisotropic;
    if (ext){
      const max = context.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
      context.texParameterf(context.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, max);
    }

    this.#cache.set(context, texture);
    return texture;
  }

  /**
   * Returns the texture for the WebGL context. If the texture does not exist for this context it will be created.
   * @param {WebGLRenderingContext} context - The WebGL context.
   */
  getWebGLTexture(context) {
    return this.#cache.get(context) || this.createWebGLTexture(context);
  }

  static isPowerOf2 = isPowerOf2;
  static nearestUpperPowerOf2 = nearestUpperPowerOf2;
}

export default Texture;

