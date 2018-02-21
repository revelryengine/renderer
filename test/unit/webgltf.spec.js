import { WebGLTF } from '../../lib/webgltf.js';

import { Accessor   } from '../../lib/accessor.js';
import { Animation  } from '../../lib/animation.js';
import { Asset      } from '../../lib/asset.js';
import { Buffer     } from '../../lib/buffer.js';
import { BufferView } from '../../lib/buffer-view.js';
import { Camera     } from '../../lib/camera.js';
import { Image      } from '../../lib/image.js';
import { Material   } from '../../lib/material.js';
import { Mesh       } from '../../lib/mesh.js';
import { Node       } from '../../lib/node.js';
import { Sampler    } from '../../lib/sampler.js';
import { Scene      } from '../../lib/scene.js';
import { Skin       } from '../../lib/skin.js';
import { Texture    } from '../../lib/texture.js';


describe('WebGLTF', () => {
  describe('basic fetching', () => {
    it('load glTF file from url', async () => {
      const gltf = await WebGLTF.fetch(new URL('/base/test/fixtures/simple.gltf', window.location.href));
      expect(gltf).to.be.an('Object');
    });
  });

  describe('version support', () => {
    it('should throw if major version number is not supported', async () => {
      const promise = WebGLTF.fetch(new URL('/base/test/fixtures/unsupported-major.gltf', window.location.href));
      return promise.catch(error => expect(error).to.be.an('error'));
    });

    it('should throw if minVersion is specified and greater than supported version', async () => {
      const promise = WebGLTF.fetch(new URL('/base/test/fixtures/unsupported-minor.gltf', window.location.href));
      return promise.catch(error => expect(error).to.be.an('error'));
    });
  });

  describe('initialization', () => {
    let gltf;
    beforeEach(async () => {
      gltf = await WebGLTF.fetch(new URL('/base/test/fixtures/simple.gltf', window.location.href));
    });

    it('should initialize asset', () => {
      expect(gltf.asset).to.be.an.instanceof(Asset);
    });

    it('should initialize all buffers', () => {
      for (const buffer of gltf.buffers) {
        expect(buffer).to.be.an.instanceof(Buffer);
      }
    });

    it('should initialize all bufferViews', () => {
      for (const bufferView of gltf.bufferViews) {
        expect(bufferView).to.be.an.instanceof(BufferView);
      }
    });

    it('should initialize all accessors', () => {
      for (const accessor of gltf.accessors) {
        expect(accessor).to.be.an.instanceof(Accessor);
      }
    });

    it('should initialize all bufferViews', () => {
      for (const image of gltf.images) {
        expect(image).to.be.an.instanceof(Image);
      }
    });

    it('should initialize all samplers', () => {
      for (const sampler of gltf.samplers) {
        expect(sampler).to.be.an.instanceof(Sampler);
      }
    });

    it('should initialize all samplers', () => {
      for (const sampler of gltf.samplers) {
        expect(sampler).to.be.an.instanceof(Sampler);
      }
    });

    it('should initialize all textures', () => {
      for (const texture of gltf.textures) {
        expect(texture).to.be.an.instanceof(Texture);
      }
    });

    it('should initialize all materials', () => {
      for (const material of gltf.materials) {
        expect(material).to.be.an.instanceof(Material);
      }
    });

    it('should initialize all skins', () => {
      for (const skin of gltf.skins) {
        expect(skin).to.be.an.instanceof(Skin);
      }
    });

    it('should initialize all cameras', () => {
      for (const camera of gltf.cameras) {
        expect(camera).to.be.an.instanceof(Camera);
      }
    });

    it('should initialize all meshes', () => {
      for (const mesh of gltf.meshes) {
        expect(mesh).to.be.an.instanceof(Mesh);
      }
    });

    it('should initialize all nodes', () => {
      for (const node of gltf.nodes) {
        expect(node).to.be.an.instanceof(Node);
      }
    });

    it('should initialize all scenes', () => {
      for (const scene of gltf.scenes) {
        expect(scene).to.be.an.instanceof(Scene);
      }
    });

    it('should initialize scene', () => {
      expect(gltf.scene).to.be.an.instanceof(Scene);
    });

    it('should initialize all animations', () => {
      for (const animation of gltf.animations) {
        expect(animation).to.be.an.instanceof(Animation);
      }
    });
  });
});
