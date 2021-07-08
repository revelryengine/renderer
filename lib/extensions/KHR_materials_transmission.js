import { extensions   } from '../extensions.js';
import { GLTFProperty } from '../gltf-property.js';
import { TextureInfo  } from '../texture-info.js';
import { Texture      } from '../texture.js';

/**
 * @see https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_transmission
 */

/**
 * KHR_materials_transmission material extension
 * @typedef {glTFProperty} khrMaterialsTransmissionMaterial
 * @property {Number} [transmissionFactor=0] - The base percentage of light that is transmitted through the surface.
 * @property {textureInfo} [transmissionTexture] - A texture that defines the transmission percentage of the surface, stored in the R channel. This will be multiplied by transmissionFactor.
 */

 const frameBufferCache = new WeakMap();

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

  applyMaterial(program, context) {
    if(this.transmissionTexture) program.applyTexture(context, this.transmissionTexture, 'transmissionTexture');

    program.uniforms.set('u_TransmissionFactor', this.transmissionFactor);

    const { renderTexture } = frameBufferCache.get(context) || {};
    if(renderTexture) {
      program.uniforms.set('u_TransmissionFramebufferSampler', renderTexture);
      program.uniforms.set('u_TransmissionFramebufferSize', [renderTexture.width, renderTexture.width]);
    }
  }
}

const proxyCache = new WeakMap();

/**
 * This renderer proxy allows us to keep a separate program cache and set LINEAR_OUTPUT 1 on all progams created.
 */
function createRendererProxy(renderer) {
  let programs = new WeakMap();
  return new Proxy(renderer, {
    get (target, prop, receiver) {
      if(prop === 'programs') {
        return programs;
      }else if(prop === 'createProgram') {
        return function(...args) {
          return target.createProgram.call(receiver, ...args, { LINEAR_OUTPUT: 1 });
        }
      }
      return Reflect.get(...arguments);
    },
    set (_, prop) {
      if(prop === 'programs') {
        return programs = new WeakMap();
      }
      return Reflect.set(...arguments);
    }
  })
}

extensions.set('KHR_materials_transmission', {
  schema: {
    Material: KHRMaterialsTransmissionMaterial,
  },
  sort(primitives) {
    return primitives.sort((a, b) => (!!a.primitive.material?.extensions.KHR_materials_transmission - !!b.primitive.material?.extensions.KHR_materials_transmission) || a.blend - b.blend || b.depth - a.depth);
  },
  render: (renderer, cameraPosition, viewMatrix, projectionMatrix, viewProjectionMatrix, sorted) => {
    let framebufferRenderer = proxyCache.get(renderer);
    if(!framebufferRenderer) framebufferRenderer = proxyCache.set(renderer, createRendererProxy(renderer)).get(renderer);

    const { context: gl } = framebufferRenderer;

    const width = Texture.nearestUpperPowerOf2(gl.canvas.width / 2);
    const height = width;

    let { renderTexture, depthTexture, framebuffer } = frameBufferCache.get(gl) || {};
    if(!renderTexture) {
      
      renderTexture = gl.createTexture();
      renderTexture.width = width;

      gl.bindTexture(gl.TEXTURE_2D, renderTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,     gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,     gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindTexture(gl.TEXTURE_2D, null);

      depthTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, depthTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,     gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,     gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT16, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
      gl.bindTexture(gl.TEXTURE_2D, null);

      framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, renderTexture, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      frameBufferCache.set(gl, { renderTexture, depthTexture, framebuffer });
    } else if(renderTexture.width !== width) {
      gl.bindTexture(gl.TEXTURE_2D, renderTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.bindTexture(gl.TEXTURE_2D, depthTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT16, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      renderTexture.width = width;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, width, height);

    for(const { primitive, node } of sorted) {
      if(primitive.material?.extensions?.KHR_materials_transmission) continue;
      framebufferRenderer.renderNodePrimitive(node, primitive, cameraPosition, viewMatrix, projectionMatrix, viewProjectionMatrix);
    }

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.bindTexture(gl.TEXTURE_2D, renderTexture);
    gl.generateMipmap(gl.TEXTURE_2D);
  },
  clearProgramCache(renderer) {
    const framebufferRenderer = proxyCache.get(renderer);
    if(framebufferRenderer) framebufferRenderer.programs = new WeakMap();
  },
});
