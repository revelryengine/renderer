import { Renderer, WebGLTF } from '../lib/webgltf.js';
import { OrbitController } from './orbit.js';

const select   = document.querySelector('#sample');
const renderer = new Renderer('#main');

const baseSampleUrl = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/8416be1c/2.0/';

let model, scene, camera;

const orbit = new OrbitController(renderer);
function resetOrbit() {
  const {
    zoomScale = 1, znear = 0.01, zfar = 100,
    cameraPos = '[3, 0, 0]',
  } = document.querySelector(`option[value="${select.value}"]`).dataset;
  camera.camera.perspective.znear = parseFloat(znear);
  camera.camera.perspective.zfar = parseFloat(zfar);
  orbit.scale = parseFloat(zoomScale);

  const [radial, azimuthal, polar] = JSON.parse(cameraPos);

  orbit.radial = radial;
  orbit.azimuthal = azimuthal;
  orbit.polar = polar;
  orbit.updateMatrix();
}

async function loadModel() {
  model = await WebGLTF.load(`${baseSampleUrl}/${select.value}/glTF/${select.value}.gltf`);
  scene = model.scene || model.scenes[0];
  camera = model.createCamera();

  resetOrbit();
}

select.addEventListener('change', loadModel);

loadModel();

(function render() {
  requestAnimationFrame(render);
  if (model) {
    camera.matrix = orbit.matrix;
    renderer.render(scene, camera);
  }
}());
