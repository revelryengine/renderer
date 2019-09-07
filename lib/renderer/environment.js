import { WebGLTF } from '../webgltf.js';

const GL = WebGLRenderingContext;

const CUBE_FACE_TARGETS = {
  '-x': GL.TEXTURE_CUBE_MAP_NEGATIVE_X,
  '+x': GL.TEXTURE_CUBE_MAP_POSITIVE_X,
  '-y': GL.TEXTURE_CUBE_MAP_NEGATIVE_Y,
  '+y': GL.TEXTURE_CUBE_MAP_POSITIVE_Y,
  '-z': GL.TEXTURE_CUBE_MAP_NEGATIVE_Z,
  '+z': GL.TEXTURE_CUBE_MAP_POSITIVE_Z,
};

/**
 * An environment is a specifically structured glTF asset that contains the neccessary images and textures to create an IBL environment.
 */
export class Environment extends WebGLTF {
  async load(...args) {
    await super.load(...args);

    this.brdfTexture = this.textures.find(texture => texture.name === 'brdf');
    this.diffuseTexture = this.textures.find(texture => texture.name === 'diffuse');
    this.specularTexture = this.textures.find(texture => texture.name === 'specular');
  }
  createTextures(context) {
    this.brdfTexture.createWebGLTexture(context);
    this.diffuseTexture.createWebGLTexture(context, GL.TEXTURE_CUBE_MAP);
    this.specularTexture.createWebGLTexture(context, GL.TEXTURE_CUBE_MAP);

    for (const { name, $data } of this.images) {
      const { groups: { type, direction, level } = {} } = /^(?<type>.*):(?<direction>.*):(?<level>.*)$/u.exec(name) || {};
      const texture = this[`${type}Texture`];
      if (texture) {
        context.activeTexture(GL.TEXTURE0);
        context.bindTexture(context.TEXTURE_CUBE_MAP, texture.getWebGLTexture(context));
        context.texImage2D(CUBE_FACE_TARGETS[direction], Number(level), GL.RGBA, GL.RGBA, GL.UNSIGNED_BYTE, $data);
      }
    }
  }
}

export default Environment;
