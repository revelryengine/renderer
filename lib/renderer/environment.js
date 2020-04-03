import { WebGLTF } from '../webgltf.js';

const GL = WebGLRenderingContext;

const CUBE_FACE_TARGETS = {
  '+x': GL.TEXTURE_CUBE_MAP_POSITIVE_X, // left
  '-x': GL.TEXTURE_CUBE_MAP_NEGATIVE_X, // right
  '+y': GL.TEXTURE_CUBE_MAP_POSITIVE_Y, // bottom
  '-y': GL.TEXTURE_CUBE_MAP_NEGATIVE_Y, // top
  '+z': GL.TEXTURE_CUBE_MAP_POSITIVE_Z, // front
  '-z': GL.TEXTURE_CUBE_MAP_NEGATIVE_Z, // back
};

/**
 * An environment is a specifically structured glTF asset that contains the neccessary images and textures to create an IBL environment.
 */
export class Environment extends WebGLTF {
  async load(...args) {
    await super.load(...args);

    this.brdfTexture = this.textures.find(texture => texture.name === 'brdf');
    this.diffuseEnvTexture = this.textures.find(texture => texture.name === 'diffuse');
    this.specularEnvTexture = this.textures.find(texture => texture.name === 'specular');
    return this;
  }

  createTextures(context) {
    this.mipCount = 0;

    this.brdfTexture.createWebGLTexture(context);
    this.diffuseEnvTexture.createWebGLTexture(context, GL.TEXTURE_CUBE_MAP);
    this.specularEnvTexture.createWebGLTexture(context, GL.TEXTURE_CUBE_MAP);

    for (const image of this.images) {
      const [match, type, direction, level] = image.name.match(/(specular|diffuse):([-+][xyz]):(\d+)/) || [];
      if(!match) continue;
      const texture = this[`${type}EnvTexture`];
      if (texture) {
        context.bindTexture(context.TEXTURE_CUBE_MAP, texture.getWebGLTexture(context));
        const data = image.getImageData();
        if(data.dataRAW){
          context.texImage2D(CUBE_FACE_TARGETS[direction], Number(level), GL.RGB9_E5, data.width, data.height, 0, GL.RGB, GL.FLOAT, new Float32Array(data.dataRAW.buffer));
        } else {
          context.texImage2D(CUBE_FACE_TARGETS[direction], Number(level), GL.RGBA, GL.RGBA, GL.UNSIGNED_BYTE, data);
        }
        this.mipCount = Math.max(this.mipCount, level);
      }
    }
  }
}

export default Environment;
