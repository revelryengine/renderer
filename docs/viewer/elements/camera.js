import { LitElement } from '../web_modules/lit-element.js';

import { Camera, Node, glMatrix } from '../web_modules/webgltf.js';
import { Graph } from '../web_modules/webgltf/lib/renderer/graph.js';

const { vec3, mat4, quat } = glMatrix;

const tmpV = vec3.create();

const UP = vec3.fromValues(0, 1, 0);
const RIGHT = vec3.fromValues(1, 0, 0);
const EPSILON = 2 ** -23;
const PHI_BOUNDS = [0, Math.PI];
const THETA_BOUNDS = [-Infinity, Infinity];
const DISTANCE_BOUNDS = [2 ** -13, Infinity];
const ZOOM_BOUNDS = [-5, 0.99];
const DAMPING = 0.75;
const DEFAULT_POSITION = vec3.fromValues(-3, 3, 6);

const ROTATE_K = 0.0025;
const ZOOM_K = 0.0001;
const PAN_K = 0.005;

function clamp(num, min, max) {
  if (num <= min) return min;
  if (num >= max) return max;
  return num;
}

export class ViewerCamera extends LitElement {
  constructor() {
    super();

    this.node = new Node({
      matrix: mat4.create(),
      camera: new Camera({
        type: 'perspective',
        perspective: {
          znear: 0.01,
          yfov: 45 * (Math.PI / 180),
        },
      }),
    });

    this.speed = { rotate: 1, zoom: 1, pan: 1 };
    this.zoom = 0;

    this.position = vec3.clone(DEFAULT_POSITION);
    this.target = vec3.fromValues(0, 0, 0);
    this.distance = vec3.length(vec3.subtract(tmpV, this.position, this.target));
    this.idealDistance = 1;

    this.input = { roll: 0, pitch: 0, zoom: 0, pan: [0, 0] };

    const ptrCache = [];
    let prevDiff = -1;

    const upEvent = (e) => {
      ptrCache.splice(ptrCache.findIndex(ev => e.pointerId === ev.pointerId), 1);
      if(ptrCache.length < 2) prevDiff = -1;
    }

    const downEvent = (e) => {
      ptrCache.push(e);
      e.preventDefault();
    }

    const moveEvent = (e) => {
      const i = ptrCache.findIndex(ev => e.pointerId === ev.pointerId);

      if(i !== -1){ // dragging
        const lastPointerEvent = ptrCache[i];
        ptrCache[i] = e;

        if(ptrCache.length === 2) {
          const curDiff = Math.abs(ptrCache[0].clientX - ptrCache[1].clientX);

          if (prevDiff > 0) {
            this.input.zoom -= (prevDiff - curDiff) * (this.speed.zoom * ZOOM_K) * 10;
          }
          prevDiff = curDiff;
        } else if(ptrCache.length === 1 && e.isPrimary) {
          const deltaX = e.clientX - lastPointerEvent.clientX;
          const deltaY = e.clientY - lastPointerEvent.clientY;
          if (e.shiftKey) {
            this.input.pan[0] += deltaX * (this.speed.pan * PAN_K * (this.distance / 10));
            this.input.pan[1] += deltaY * (this.speed.pan * PAN_K * (this.distance / 10));
          } else {
            this.input.roll += deltaX * (this.speed.rotate * ROTATE_K);
            this.input.pitch += deltaY * (this.speed.rotate * ROTATE_K);
          }
        }
      }
      e.preventDefault();
    }

    const zoomEvent = (e) => {
      this.input.zoom -= e.deltaY * (this.speed.zoom * ZOOM_K) ;
    }


    this.addEventListener('mousewheel', zoomEvent, { passive: true });
    this.addEventListener('pointerdown', downEvent, { passive:false });
    this.addEventListener('pointermove', moveEvent, { passive:false });
    this.addEventListener('pointerup', upEvent);
    window.addEventListener('pointerout', () => {
      ptrCache.length = 0;
    });

    this.graph = new Graph();
  }

  update() {
    const { position, target, input, node, idealDistance } = this;
    const { matrix } = node;
    let { distance, zoom } = this;

    // ------Panning-----------
    const up = vec3.fromValues(matrix[4], matrix[5], matrix[6]);
    const right = vec3.fromValues(matrix[0], matrix[1], matrix[2]);

    const moveRight = vec3.create();
    const moveUp = vec3.create();

    vec3.scale(moveRight, right, (vec3.dot(up, RIGHT) + vec3.dot(right, RIGHT)) * -input.pan[0]);
    vec3.scale(moveUp, up, (vec3.dot(up, UP) + vec3.dot(right, UP)) * input.pan[1]);

    vec3.add(position, position, moveRight);
    vec3.add(position, position, moveUp);
    vec3.add(target, target, moveRight);
    vec3.add(target, target, moveUp);

    // ------Orbit-------------
    const offset = vec3.create();
    vec3.subtract(offset, position, target);

    let theta = Math.atan2(offset[0], offset[2]);
    let phi = Math.atan2(Math.sqrt((offset[0] * offset[0]) + (offset[2] * offset[2])), offset[1]);

    theta -= input.roll;
    phi -= input.pitch;

    theta = clamp(theta, THETA_BOUNDS[0], THETA_BOUNDS[1]);
    phi = clamp(phi, PHI_BOUNDS[0], PHI_BOUNDS[1]);
    phi = clamp(phi, EPSILON, Math.PI - EPSILON);

    zoom += input.zoom;
    zoom = clamp(zoom, ZOOM_BOUNDS[0], ZOOM_BOUNDS[1]);


    distance = idealDistance - (idealDistance * zoom);
    distance = clamp(distance, DISTANCE_BOUNDS[0], DISTANCE_BOUNDS[1]);

    const radius = Math.abs(distance) <= EPSILON ? EPSILON : distance;
    offset[0] = radius * Math.sin(phi) * Math.sin(theta);
    offset[1] = radius * Math.cos(phi);
    offset[2] = radius * Math.sin(phi) * Math.cos(theta);

    this.zoom = zoom;
    this.distance = distance;

    vec3.add(position, target, offset);

    mat4.lookAt(this.node.matrix, position, target, UP);
    mat4.invert(this.node.matrix, this.node.matrix);

    input.roll *= DAMPING;
    input.pitch *= DAMPING;
    input.zoom *= DAMPING;
    input.pan[0] *= DAMPING;
    input.pan[1] *= DAMPING;

    this.position = position;
    this.target = target;
  }

  getPrimitiveBounds(accessor, nodeTransform) {
    const min = vec3.create();
    const max = vec3.create();

    for(const i of [0, 1, 2]){
      min[i] = Infinity;
      max[i] = -Infinity;
    }

    const boxMin = vec3.create();
    vec3.transformMat4(boxMin, accessor.min, nodeTransform);

    const boxMax = vec3.create();
    vec3.transformMat4(boxMax, accessor.max, nodeTransform);

    const center = vec3.create();
    vec3.add(center, boxMax, boxMin);
    vec3.scale(center, center, 0.5);

    const centerToSurface = vec3.create();
    vec3.sub(centerToSurface, boxMax, center);

    const radius = vec3.length(centerToSurface);

    for (const i of [0, 1, 2]) {
        min[i] = center[i] - radius;
        max[i] = center[i] + radius;
    }

    return { min, max }
  }

  getNodeBounds(node) {
    const nodeTransform = this.graph.getWorldTransform(node);

    const min = vec3.create();
    const max = vec3.create();

    for(const i of [0, 1, 2]){
      min[i] = Infinity;
      max[i] = -Infinity;
    }

    if(node.mesh && node.mesh.primitives) {
      for(const primitive of node.mesh.primitives) {
        if(primitive.attributes.POSITION) {
          const { min: pMin, max: pMax } = this.getPrimitiveBounds(primitive.attributes.POSITION, nodeTransform);

          for (const i of [0, 1, 2]) {
            min[i] = Math.min(min[i], pMin[i]);
            max[i] = Math.max(max[i], pMax[i]);
          }
        }
      }
    }

    if(node.children) {
      for(const child of node.children){
        const { min: nMin, max: nMax } = this.getNodeBounds(child);
        for (const i of [0, 1, 2]) {
          min[i] = Math.min(min[i], nMin[i]);
          max[i] = Math.max(max[i], nMax[i]);
        }
      }
    }

    return { min, max };
  }

  getSceneBounds(scene) {
    const min = vec3.create();
    const max = vec3.create();

    for(const i of [0, 1, 2]){
      min[i] = Infinity;
      max[i] = -Infinity;
    }

    for(const node of scene.nodes) {
      if(!node.camera) {
        const { min: nMin, max: nMax } = this.getNodeBounds(node);
        for (const i of [0, 1, 2]) {
          min[i] = Math.min(min[i], nMin[i]);
          max[i] = Math.max(max[i], nMax[i]);
        }
      }
    }

    return { min, max };
  }

  resetToScene(scene) {
    this.graph.analyze(scene);

    const { min, max } = this.getSceneBounds(scene);

    for (const i of [0, 1, 2]) {
      this.target[i] = (max[i] + min[i]) / 2;
    }

    const height = max[1] - this.target[1];

    this.idealDistance = height / Math.tan(this.node.camera[this.node.camera.type].yfov / 2);

    this.node.camera[this.node.camera.type].znear = this.idealDistance / 100;
    this.node.camera[this.node.camera.type].zfar = this.idealDistance * 100;

    this.position[0] = this.target[0];
    this.position[1] = this.target[1];
    this.position[2] = this.target[2] + this.idealDistance;

    this.zoom = 0;

    this.update();
  }

  getRigidTransform() {

    const inverse = mat4.create();
    const translation = vec3.create();
    const orientation = quat.create();

    mat4.invert(inverse, this.node.matrix);
    mat4.getTranslation(translation, inverse);
    mat4.getRotation(orientation, inverse);

    return new XRRigidTransform(
      { x: translation[0], y: translation[1], z: translation[2] },
      { x: orientation[0], y: orientation[1], z: orientation[2], w: orientation[3] });
  }
}

customElements.define('webgltf-viewer-camera', ViewerCamera);

export default ViewerCamera;
