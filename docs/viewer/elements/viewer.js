import { LitElement, html, css } from '../web_modules/lit-element.js';

import { WebGLTF } from '../web_modules/webgltf.js';
import { Renderer, RendererXR } from '../web_modules/webgltf/lib/renderer/renderer.js';
import { Animator    } from '../web_modules/webgltf/lib/renderer/animator.js';
import { Environment } from '../web_modules/webgltf/lib/renderer/environment.js';
import '../web_modules/webgltf/lib/extensions/KHR_draco_mesh_compression.js';

import './controls/controls.js';
import './camera.js';

const environment = Environment.load(new URL('./viewer/environments/papermill.gltf', window.location.href));

class WebGLTFViewerElement extends LitElement {
  static get properties() {
    return {
      src: { type: String, reflect: true },
      showcontrols: { type: Boolean, reflect: true },
      loading: { type: Boolean, reflect: true},
      xrSupported: { type: Boolean, reflect: true },
      xrSession: { type: Object },
    }
  }

  async connectedCallback(){
    super.connectedCallback();
    this.canvas = document.createElement('canvas');
    this.camera = document.createElement('webgltf-viewer-camera');
    if(this.showcontrols) {
      this.controls = document.createElement('webgltf-viewer-controls');
      this.controls.addEventListener('change', () => this.onControlsChange());
    }
    this.renderer = new Renderer(this.canvas, { ibl: await environment });
    this.xrSupported =  navigator.xr ||  await navigator.xr.isSessionSupported('immersive-vr');
  }

  async disconnectedCallback() {
    this.renderer.destroy();
  }

  async loadModel() {
    try {
      this.loading = true;
      this.webgltf = await WebGLTF.load(this.src, { lazy: true });

      this.animator = new Animator(this.webgltf.animations);

      this.scene = this.webgltf.scene || this.webgltf.scenes[0];
      this.camera.resetToScene(this.scene);
      this.lastRenderTime = performance.now();

      cancelAnimationFrame(this.requestId);
      this.requestId = requestAnimationFrame(t => this.renderWebGLTF(t));
      this.requestUpdate();

      console.log(this.webgltf);
      this.loading = false;
    } catch(e) {
      console.error(e);
    }

  }

  attributeChangedCallback(name, oldval, newval) {
    super.attributeChangedCallback(name, oldval, newval);
    if(name === 'src' && newval && oldval !== newval) {
      this.loadModel();
    }
  }

  render(){
    if(this.controls) this.controls.webgltf = this.webgltf;
    const XRButton = this.xrSupported ? html`<button class="xr-button" @click="${() => this.toggleVR()}">Toggle VR</button>` : '';
    return html`
      ${XRButton}
      ${this.camera}
      ${this.canvas}
      ${this.controls}

      <div class="loader">Loading...</div>
    `;
  }

  onControlsChange() {
    this.src = this.controls.model.src;
  }

  renderWebGLTF(hrTime) {
    this.requestId = requestAnimationFrame(t => this.renderWebGLTF(t));

    if (this.scene) {
      const delta = hrTime - this.lastRenderTime;
      this.camera.update();

      const scene = this.controls && this.webgltf.scenes[this.controls.scene.scene] || this.scene;
      const camera = this.controls && this.webgltf.nodes[this.controls.scene.camera] || this.camera.node;

      this.animator.update(delta);
      this.renderer.render(scene, camera);
    }

    this.lastRenderTime = hrTime;
  }

  renderWebGLTFXR(hrTime, xrFrame) {
    this.xrRequestId = this.xrSession.requestAnimationFrame((hrTime, xrFrame) => this.renderWebGLTFXR(hrTime, xrFrame));

    if(this.scene) {
      const scene = this.controls && this.webgltf.scenes[this.controls.scene.scene] || this.scene;

      for (let source of this.xrSession.inputSources) {
        if (source.gamepad) {
          const [a] = source.gamepad.buttons;
          const [x, y] = source.gamepad.axes;

          if(a.pressed) {
            this.camera.input.pan[0] += x;
            this.camera.input.pan[1] += y;
          } else {
            if(Math.abs(x) > 0.01) this.camera.input.roll -= x * this.camera.speed.rotate * 0.025;
            if(Math.abs(y) > 0.01) this.camera.input.pitch -= y * this.camera.speed.rotate * 0.025;
          }
        }
      }

      this.xrRenderer.render(scene, this.xrRefSpace.getOffsetReferenceSpace(this.camera.getRigidTransform()), xrFrame);
    }
  }

  async toggleVR() {
    if(!this.xrSession) {
      this.xrSession  = await navigator.xr.requestSession('immersive-vr');
      this.xrRenderer = new RendererXR({ ibl: await environment });

      this.xrSession.updateRenderState({ baseLayer: new XRWebGLLayer(this.xrSession, this.xrRenderer.context) });
      this.xrRefSpace = await this.xrSession.requestReferenceSpace('local');
      this.xrRequestId = this.xrSession.requestAnimationFrame((hrTime, xrFrame) => this.renderWebGLTFXR(hrTime, xrFrame));
    } else {
      this.xrSession.end();
      this.xrRenderer.destroy();
      delete this.xrRenderer;
      delete this.xrSession;
    }
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

      .loader {
        display: none;
        position: absolute;
        bottom: 25px;
        left: 25px;
        color: var(--primary-text);
      }

      canvas {
        width: 100%;
        height: 100%;
      }

      webgltf-viewer-camera {
        z-index: 1;
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        touch-action: none;
      }

      webgltf-viewer-controls {
        z-index: 1;
        position: absolute;
        right: 0;
        bottom: 0;
      }

      aside .controls {
        max-height: 500px;
        transition: max-height 0.3s ease-out;
        background-color: var(--primary);
        display: flex;
        flex-direction: column;
      }

      aside.closed .controls {
        max-height: 0px;
        overflow: hidden;
      }

      aside .controls select {
        width: 100%;
      }

      .xr-button {
        position: absolute;
        bottom: 5px;
        left: 5px;
        z-index: 2;
      }
    `;
  }
}

customElements.define('webgltf-viewer', WebGLTFViewerElement);
