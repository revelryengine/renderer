import { LitElement, html, css } from '../../web_modules/lit-element.js';

import '../icon.js';
import '../fab.js';
import './model.js';
import './scene.js';

class WebGLTFViewerControls extends LitElement {
  static get properties() {
    return {
      collapsed: { type: Boolean, reflect: true },
      webgltf: { type: Object },
    }
  }

  constructor() {
    super();
    this.collapsed = true;

    this.model = document.createElement('webgltf-viewer-control-model');
    this.model.addEventListener('change', () => this.updated());

    this.scene = document.createElement('webgltf-viewer-control-scene');
    this.scene.addEventListener('change', () => this.updated());

    // auto collapse the controls if clicking somewhere else
    window.addEventListener('pointerdown', (e) => {
      var path = e.path || (e.composedPath && e.composedPath());
      if(path.find(el => el === this)) return;
      this.collapsed = true;
    });
  }

  updated() {
    this.dispatchEvent(new Event('change'));
  }

  render() {
    this.model.webgltf = this.webgltf;
    this.scene.webgltf = this.webgltf;

    return html`
      <webgltf-fab icon="sliders-h" @click="${() => this.collapsed = false}"></webgltf-fab>
      <aside>
        <div class="controls">
          ${this.model}
          ${this.scene}
        </div>
      </aside>
    `;
  }

  static get styles() {
    return css`
      :host {
        color: var(--primary-text);
        display: block;
        position: relative;
      }

      webgltf-fab {
        position: absolute;
        bottom: 0;
        right: 0;
        transition: opacity 0.1s ease-in-out;
        z-index: 1;
      }

      :host(:not([collapsed])) webgltf-fab {
        opacity: 0;
        pointer-events: none;
      }

      aside {
        max-width: 400px;
        max-height: 1000px;
        overflow: hidden;
        background-color: var(--primary);
        bottom: 0;
        right: 0;
        margin: 16px;
        box-shadow: var(--card-shadow-1);
        transition: max-width 0.2s ease-in-out, max-height 0.2s ease-in-out, border-radius 0.3s ease-in-out, margin 0.1s;
      }

      :host([collapsed]) aside {
        border-radius: 56px;
        max-height: 56px;
        max-width: 56px;
      }

      :host([collapsed]) aside .controls {
        opacity: 0;
      }

      aside .controls {
        transition: opacity 0.2s ease-in-out;
      }
    `;
  }
}

customElements.define('webgltf-viewer-controls', WebGLTFViewerControls);


