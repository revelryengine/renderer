import { mat4, vec3 } from '../vendor/gl-matrix.js';

export class OrbitController {
  constructor(renderer, matrix) {
    this.renderer = renderer;
    this.matrix = matrix;

    this.radial = 3;
    this.polar = 0;
    this.azimuthal = 0;

    this.mousedown = null;

    this.renderer.context.canvas.addEventListener('wheel', (e) => {
      this.radial += e.deltaY / 300;
      this.radial = Math.max(this.radial, 0);
      this.updateMatrix();
    }, { passive: true });

    this.renderer.context.canvas.addEventListener('mousedown', (e) => { this.mousedown = e; });

    this.renderer.context.canvas.addEventListener('mousemove', (e) => {
      if (this.mousedown) {
        this.azimuthal += (e.clientX - this.mousedown.clientX) / 300;
        this.polar += (e.clientY - this.mousedown.clientY) / 300;
        this.mousedown = e;
        this.updateMatrix();
      }
    });

    window.addEventListener('mouseup', () => { this.mousedown = null; });
    this.updateMatrix();
  }

  updateMatrix() {
    const t = this.radial * Math.cos(this.polar);
    const y = this.radial * Math.sin(this.polar);
    const x = t * Math.cos(this.azimuthal);
    const z = t * Math.sin(this.azimuthal);

    const position = vec3.create();

    mat4.getTranslation(position, this.matrix);
    mat4.translate(this.matrix, this.matrix, position);
    vec3.set(position, x, y, z);
    mat4.translate(this.matrix, this.matrix, position);
    mat4.targetTo(this.matrix, position, [0, 0, 0], [0, 1, 0]);
  }
}

export default OrbitController;
