import { Renderer, WebGLTF } from '../lib/webgltf.js';
import { mat4 } from '../vendor/gl-matrix.js';

const url = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/8416be1c/2.0/DamagedHelmet/glTF/DamagedHelmet.gltf';
// const url = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/8416be1c/2.0/Box/glTF/Box.gltf';
// const url = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/8416be1c/2.0/Cube/glTF/Cube.gltf';
// const url = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/8416be1c/2.0/Duck/glTF/Duck.gltf';
// const url = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/8416be1c/2.0/MetalRoughSpheres/glTF/MetalRoughSpheres.gltf';
// const url = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/8416be1c/2.0/Triangle/glTF/Triangle.gltf';
// const url = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/8416be1c/2.0/Monster/glTF/Monster.gltf';
(async () => {
  const renderer = new Renderer('#main');
  const model = await WebGLTF.load(url);
  const camera = model.createCamera();

  mat4.lookAt(camera.matrix, [0, 0, -4], [0, 0, 0], [0, 1, 0]);

  requestAnimationFrame(function tick() {
    requestAnimationFrame(tick);
    renderer.render(model.scene || model.scenes[0], camera);
  });
})();
