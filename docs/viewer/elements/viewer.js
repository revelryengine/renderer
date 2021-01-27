import { LitElement, html, css } from 'https://cdn.skypack.dev/lit-element';

import { WebGLTF } from '/lib/webgltf.js';
import { Renderer } from '/lib/renderer/renderer.js';
import { Animator    } from '/lib/renderer/animator.js';
import { Environment } from '/lib/renderer/environment.js';
import '/lib/extensions/KHR_draco_mesh_compression.js';

import './controls/controls.js';
import './camera.js';
import './vr.js';

const environment = Environment.load(new URL('./viewer/environments/papermill.gltf', window.location.href));

class WebGLTFViewerElement extends LitElement {
  static get properties() {
    return {
      src:          { type: String,  reflect: true },
      showcontrols: { type: Boolean, reflect: true },
      loading:      { type: Boolean, reflect: true },
      error:        { type: String,  reflect: true },
    }
  }

  constructor() {
    super();
    this.canvas   = document.createElement('canvas');
    this.camera   = document.createElement('webgltf-viewer-camera');
    this.controls = document.createElement('webgltf-viewer-controls');
    this.controls.addEventListener('change', () => this.onControlsChange());

    this.renderer = new Renderer(this.canvas);
    environment.then(environment => {
      environment.createTextures(this.renderer.context);
      this.renderer.ibl = environment;
    });

    this.vrControl = document.createElement('webgltf-vr-control');
    this.vrControl.viewer = this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.requestId = requestAnimationFrame(t => this.renderWebGLTF(t));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    cancelAnimationFrame(this.requestId);
    if(this.abortController) this.abortController.abort();
  }

  async loadModel() {
    this.loading = true;
    this.error = false;
    this.renderer.scaleFactor = 0.25;
    try {
      if(this.abortController) this.abortController.abort(); //abort any previously started loads

      await environment;

      this.abortController = new AbortController();

      this.webgltf = await WebGLTF.load(this.src, this.abortController);
      await this.renderer.preload(this.webgltf, this.abortController);


      this.animator = new Animator(this.webgltf.animations);
      this.scene = this.webgltf.scene || this.webgltf.scenes[0];
      this.camera.resetToScene(this.scene);
      this.lastRenderTime = performance.now();

      this.requestUpdate();

      console.log(this.webgltf);
    } catch(e) {
      if(e.name !== 'AbortError') {
        this.error = e.message;
        console.trace(e);
      }
    }
    this.renderer.scaleFactor = 1;
    this.loading = false;
  }

  attributeChangedCallback(name, oldval, newval) {
    super.attributeChangedCallback(name, oldval, newval);
    if(name === 'src' && newval && oldval !== newval) {
      this.loadModel();
    }
  }

  render(){
    if(this.controls) this.controls.webgltf = this.webgltf;
    // const XRButton = this.xrSupported ? html`<button class="xr-button" @click="${() => this.toggleVR()}">Toggle VR</button>` : '';
    return html`
      ${this.camera}
      ${this.canvas}
      ${this.vrControl}
      ${this.showcontrols ? this.controls : ''}
      <div class="loader"><webgltf-icon name="spinner"></webgltf-icon> Loading</div>
      <div class="error ${this.error ? 'show': 'hide'}">
        <webgltf-icon name="exclamation-circle"></webgltf-icon> Failed to load model
        <small><pre>${this.error}</pre></small>
        <button @click="${() => this.error = false}">Dismiss</button>
      </div>
    `;
  }

  onControlsChange() {
    this.src = this.controls.model.src;
    this.scene = this.webgltf && this.webgltf.scenes[this.controls.scene.scene];
    this.cameraNode = this.webgltf && this.webgltf.nodes[this.controls.scene.camera];
  }

  renderWebGLTF(hrTime) {
    this.requestId = requestAnimationFrame(t => this.renderWebGLTF(t));

    if (this.scene) {
      const delta = hrTime - this.lastRenderTime;
      this.camera.update();

      this.animator.update(delta);
      this.renderer.render(this.scene, this.cameraNode || this.camera.node);
    }

    this.lastRenderTime = hrTime;
  }

  static get styles() {
    return css`
      :host {
        display: flex;
        position: relative;
        background-color: var(--primary-light);
        width: 100%;
        height: 100%;
      }

      :host([loading]) canvas {
        filter: blur(4px);
      }

      :host([loading]) .loader {
        display: inline-block;
      }

      .error.show {
        display: inline-block;
        font-size: var(--font-size-m);
      }

      .error button {
        float: right;
        cursor: pointer;
      }

      .loader, .error {
        display: none;
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        font-size: var(--font-size-l);
        background-color: var(--primary);
        padding: 15px;
        border-radius: 5px;
        z-index: 3;
      }

      .loader webgltf-icon {
        animation: spin 2s linear infinite;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      canvas {
        width: 100%;
        height: 100%;
        touch-action: none;
      }

      webgltf-viewer-camera {
        z-index: 1;
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        touch-action: none;
        line-height: 24px;
      }

      webgltf-viewer-controls {
        z-index: 12;
        position: absolute;
        right: 0;
        bottom: 0;
      }

      webgltf-vr-control {
        z-index: 12; /* the docisfy sidebar button is 11 */
        position: absolute;
        bottom: 0;
        left: 0;
      }
    `;
  }
}

customElements.define('webgltf-viewer', WebGLTFViewerElement);
