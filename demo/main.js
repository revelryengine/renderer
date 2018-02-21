import { Renderer, WebGLTF } from '../lib/webgltf.js';

(async () => {
  await Renderer.ready;
  const renderer = new Renderer('#main');
  const model = await WebGLTF.fetch('https://rawgit.com/KhronosGroup/glTF-Sample-Models/master/2.0/AnimatedCube/glTF/AnimatedCube.gltf');
  model.init(renderer);
})();
