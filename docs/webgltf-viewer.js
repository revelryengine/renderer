import './webgltf-camera.js';
import { Renderer, Animator, WebGLTF } from '../lib/webgltf.js';

const io = new IntersectionObserver(entries => entries.forEach(entry => entry.target.onIntersectUpdate(entry)));

export class WebGLTFViewer extends HTMLElement {
  connectedCallback() {
    this.camera = this.querySelector('webgltf-camera') || this.appendChild(document.createElement('webgltf-camera'));

    this.canvas = document.createElement('canvas');
    this.appendChild(this.canvas);

    io.observe(this);
  }

  disconnectedCallback() {
    io.unobserve(this);
  }

  onIntersectUpdate(entry) {
    if (entry.isIntersecting) {
      if (!this.inViewport) {
        this.inViewport = true;
        this.load();
      }
    } else {
      this.inViewport = false;
      if (this.renderer) this.renderer.extensions.WEBGL_lose_context.loseContext();
      this.renderer = null;
      this.model = null;
      this.animator = null;
      this.scene = null;

      cancelAnimationFrame(this.requestId);
    }
  }

  async load() {
    const src = this.getAttribute('src');
    if (!this.inViewport || !src) return;
    this.classList.add('loading');

    this.requestId = requestAnimationFrame(t => this.render(t));

    // replace canvas in case context was lost
    this.removeChild(this.canvas);
    this.canvas = this.appendChild(document.createElement('canvas'));

    this.renderer = new Renderer(this.canvas);

    this.model = await WebGLTF.load(src);

    this.animator = new Animator(this.model.animations);
    this.scene = this.model.scene || this.model.scenes[0];
    this.classList.remove('loading');
  }

  render(hrTime) {
    this.requestId = requestAnimationFrame(t => this.render(t));

    if (this.scene) {
      const delta = hrTime - this.lastRenderTime;

      this.camera.update();

      this.animator.update(delta);
      this.renderer.render(this.scene, this.camera.node);
    }

    this.lastRenderTime = hrTime;
  }

  async attributeChangedCallback(name) {
    if (name === 'src') {
      this.load();
    }
  }

  static get observedAttributes() { return ['src']; }
}


customElements.define('webgltf-viewer', WebGLTFViewer);

export default WebGLTFViewer;

