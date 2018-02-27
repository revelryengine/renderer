import { Renderer, WebGLTF } from '../lib/webgltf.js';

(async () => {
  const renderer = new Renderer('#main');
  const model = await WebGLTF.load('https://cdn.rawgit.com/KhronosGroup/glTF-Sample-Models/8416be1c/2.0/DamagedHelmet/glTF/DamagedHelmet.gltf');
  const camera = model.createCamera();

  requestAnimationFrame(function tick() {
    requestAnimationFrame(tick);
    renderer.render(model.scene, camera);
  });
})();
