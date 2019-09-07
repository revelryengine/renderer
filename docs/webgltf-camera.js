import { Camera, Node } from '../lib/webgltf.js';
import { vec3, mat4 } from '../vendor/gl-matrix.js';

const tmpV = vec3.create();

const UP = vec3.fromValues(0, 1, 0);
const RIGHT = vec3.fromValues(1, 0, 0);
const EPSILON = 2 ** -23;
const PHI_BOUNDS = [0, Math.PI];
const THETA_BOUNDS = [-Infinity, Infinity];
const DISTANCE_BOUNDS = [0, Infinity];
const DAMPING = 0.75;
const DEFAULT_POSITION = vec3.fromValues(-3, 3, 6);

const ROTATE_K = 0.0025;
const ZOOM_K = 0.001;
const PAN_K = 0.01;

function clamp(num, min, max) {
  if (num <= min) return min;
  if (num >= max) return max;
  return num;
}

export class WebGLTFCamera extends HTMLElement {
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

    this.position = vec3.clone(DEFAULT_POSITION);
    this.target = vec3.fromValues(0, 0, 0);
    this.distance = vec3.length(vec3.subtract(tmpV, this.position, this.target));

    this.input = { roll: 0, pitch: 0, zoom: 0, pan: [0, 0] };
    this.lastMouseEvent = null;

    this.addEventListener('mousewheel', (e) => {
      if (e.shiftKey) {
        this.input.zoom += e.deltaY * (this.speed.zoom * ZOOM_K);
      }
    }, { passive: true });

    this.addEventListener('mousedown', (e) => {
      this.lastMouseEvent = e;
      e.preventDefault();
      window.addEventListener('mouseup', () => { this.lastMouseEvent = null; }, { once: true });
    });

    this.addEventListener('mousemove', (e) => {
      if (this.lastMouseEvent) {
        const deltaX = e.clientX - this.lastMouseEvent.clientX;
        const deltaY = e.clientY - this.lastMouseEvent.clientY;

        if (e.shiftKey) {
          this.input.pan[0] += deltaX * (this.speed.pan * PAN_K);
          this.input.pan[1] += deltaY * (this.speed.pan * PAN_K);
        } else {
          this.input.roll += deltaX * (this.speed.rotate * ROTATE_K);
          this.input.pitch += deltaY * (this.speed.rotate * ROTATE_K);
        }
        this.lastMouseEvent = e;
      }
    });
  }

  update() {
    const { position, target, input, node } = this;
    const { matrix } = node;
    let { distance } = this;

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

    distance += input.zoom;
    distance = clamp(distance, DISTANCE_BOUNDS[0], DISTANCE_BOUNDS[1]);

    const radius = Math.abs(distance) <= EPSILON ? EPSILON : distance;
    offset[0] = radius * Math.sin(phi) * Math.sin(theta);
    offset[1] = radius * Math.cos(phi);
    offset[2] = radius * Math.sin(phi) * Math.cos(theta);

    this.distance = distance;

    vec3.add(position, target, offset);

    mat4.lookAt(this.node.matrix, position, target, UP);
    mat4.invert(this.node.matrix, this.node.matrix);

    input.roll *= DAMPING;
    input.pitch *= DAMPING;
    input.zoom *= DAMPING;
    input.pan[0] *= DAMPING;
    input.pan[1] *= DAMPING;

    this.setAttribute('position', JSON.stringify([...position]));
    this.setAttribute('target', JSON.stringify([...target]));
  }

  async attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case 'active':
        this.dispatchEvent(new Event('activecamera'));
        break;
      case 'type':
        this.node.camera.type = newValue;
        break;
      case 'position':
        vec3.copy(this.position, JSON.parse(newValue));
        this.distance = vec3.length(vec3.subtract(tmpV, this.position, this.target));
        break;
      case 'target':
        vec3.copy(this.target, JSON.parse(newValue));
        this.distance = vec3.length(vec3.subtract(tmpV, this.position, this.target));
        break;
      case 'rotate-speed':
        this.speed.rotate = parseFloat(newValue);
        break;
      case 'zoom-speed':
        this.speed.zoom = parseFloat(newValue);
        break;
      case 'pan-speed':
        this.speed.pan = parseFloat(newValue);
        break;
      default:
        this.node.camera[this.node.camera.type][name] = parseFloat(newValue);
    }
  }

  static get observedAttributes() {
    return [
      'active', 'type', 'xmag', 'ymag', 'zfar', 'znear', 'aspect-ratio', 'yfov',
      'position', 'target', 'rotate-speed', 'zoom-speed', 'pan-speed',
    ];
  }
}

customElements.define('webgltf-camera', WebGLTFCamera);

export default WebGLTFCamera;
