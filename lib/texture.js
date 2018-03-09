

import { NamedGLTFProperty } from './named-gltf-property.js';

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

  canvas.height = width;
  canvas.height = height;

  ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

/**
 * A class wrapper around the glTF texture object.
 */
export class Texture extends NamedGLTFProperty {
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

  /**
   * Dereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  dereference(root) {
    super.dereference('sampler', root.samplers);
    super.dereference('source', root.images);
  }

  /**
   * Rereference glTF index properties.
   * @param {WebGLTF} root - The root WebGLTF object.
   */
  rereference(root) {
    super.rereference('sampler', root.samplers);
    super.rereference('source', root.images);
  }

  /**
   * Creates a texture in a WebGL context.
   * @param {WebGLRenderingContext} context - The WebGL context.
   */
  createTexture(context) {
    const {
      source: { $data },
      sampler: { wrapS = GL.REPEAT, wrapT = GL.REPEAT, minFilter = GL.LINEAR, magFilter = GL.LINEAR } = {},
    } = this;

    const texture = context.createTexture();
    context.activeTexture(GL.TEXTURE0);
    context.bindTexture(GL.TEXTURE_2D, texture);

    context.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, wrapS);
    context.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, wrapT);
    context.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, minFilter);
    context.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, magFilter);

    context.pixelStorei(GL.UNPACK_FLIP_Y_WEBGL, false);
    context.pixelStorei(GL.UNPACK_COLORSPACE_CONVERSION_WEBGL, GL.NONE);

    let image = $data;
    if ((MIPMAP_FILTERS.has(minFilter) || REPEAT_WRAPS.has(wrapS) || REPEAT_WRAPS.has(wrapT))
      && !isPowerOf2($data.width)) {
      image = resizeImage($data);
    }

    context.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, GL.RGBA, GL.UNSIGNED_BYTE, image);

    if (MIPMAP_FILTERS.has(minFilter)) {
      context.generateMipmap(GL.TEXTURE_2D);
    }

    return texture;
  }
}

export default Texture;

