import { Renderer, WebGLTF } from '../lib/webgltf.js';
import { mat4 } from '../vendor/gl-matrix.js';
import { OrbitController } from './orbit.js';

const select   = document.querySelector('#sample');
const renderer = new Renderer('#main');

const baseSampleUrl = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/8416be1c/2.0/';

let model, scene, camera;
const matrix = mat4.create();

async function loadModel() {
  model = await WebGLTF.load(`${baseSampleUrl}/${select.value}/glTF/${select.value}.gltf`);
  scene = model.scene || model.scenes[0];
  camera = model.createCamera({ position: { matrix } });
}

select.addEventListener('change', loadModel);

loadModel();

(function render() {
  requestAnimationFrame(render);
  if (camera) mat4.copy(camera.matrix, matrix);
  if (model) renderer.render(scene, camera);
}());

window.orbit = new OrbitController(renderer, matrix);
