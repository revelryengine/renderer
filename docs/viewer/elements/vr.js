import { LitElement, html, css } from '../web_modules/lit-element.js';

import './icon.js';
import './fab.js';

class WebGLTFVRControl extends LitElement {
  static get properties() {
    return {
      supported: { type: Boolean, reflect: true }
    }
  }

  async connectedCallback(){
    super.connectedCallback();
    this.supported = navigator.xr && await navigator.xr.isSessionSupported('immersive-vr');
  }

  render(){
    return html`
      <span class="unsupported" title="VR not supported on this device"></span>
      <webgltf-fab icon="${this.xrSession ? 'desktop': 'vr-cardboard'}" @click="${() => this.toggleVR()}" ?disabled="${!this.supported}"></webgltf-fab>
    `;
  }

  async toggleVR(){
    if(!this.xrSession) {
      this.xrSession  = await navigator.xr.requestSession('immersive-vr');

      this.xrSession.updateRenderState({ baseLayer: new XRWebGLLayer(this.xrSession, this.viewer.renderer.context) });
      this.xrRefSpace = await this.xrSession.requestReferenceSpace('local');
      this.xrRequestId = this.xrSession.requestAnimationFrame((hrTime, xrFrame) => this.renderWebGLTFXR(hrTime, xrFrame));
    } else {
      this.xrSession.end();
      delete this.xrSession;
      this.viewer.renderer.context.canvas.width = 0;
    }
    this.requestUpdate();
  }

  renderWebGLTFXR(hrTime, xrFrame) {
    this.xrRequestId = this.xrSession.requestAnimationFrame((hrTime, xrFrame) => this.renderWebGLTFXR(hrTime, xrFrame));

    if(this.viewer && this.viewer.scene) {
      for (let source of this.xrSession.inputSources) {
        if (source.gamepad) {
          const [trigger, squeeze] = source.gamepad.buttons;
          const [thumbX, thumbY] = source.gamepad.axes;

          // console.log(...source.gamepad.buttons);
          // console.log(...source.gamepad.axes);
          if(trigger.pressed) {
            if(Math.abs(thumbX) > 0.01) this.viewer.camera.input.pan[0] += thumbX * 0.025;
            if(Math.abs(thumbY) > 0.01) this.viewer.camera.input.pan[1] += thumbY * 0.025;
          } if(squeeze.pressed) {
            if(Math.abs(thumbY) > 0.01) this.viewer.camera.zoom += thumbY * 0.025;
          } else {
            if(Math.abs(thumbX) > 0.01) this.viewer.camera.input.roll += thumbX * this.viewer.camera.speed.rotate * 0.025;
            if(Math.abs(thumbY) > 0.01) this.viewer.camera.input.pitch += thumbY * this.viewer.camera.speed.rotate * 0.025;
          }
        }
      }

      this.viewer.renderer.renderXR(this.viewer.scene, this.xrRefSpace.getOffsetReferenceSpace(this.viewer.camera.getRigidTransform()), xrFrame)
    }
  }

  static get styles() {
    return css`
      :host {
        color: var(--primary-text);
        display: block;
      }

      aside {
        margin: 15px;
        border-radius: 100%;

        height: 56px;
        width: 56px;

        overflow: hidden;
        background-color: var(--primary);
      }

      .toggle {
        background-color: var(--primary);
        padding: 15px;

      }

      .toggle:hover {
        background-color: var(--primary-light);
        cursor: pointer;
      }

      .unsupported {
        position: absolute;
        width: 56px;
        height: 56px;
        border-radius: 56px;
        margin: 16px;
      }

      :host([supported]) .unsupported {
        display: none;
      }
    `;
  }
}

customElements.define('webgltf-vr-control', WebGLTFVRControl);


