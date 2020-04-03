import { LitElement, html, css } from '../../web_modules/lit-element.js';

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
  }

  updated() {
    this.dispatchEvent(new Event('change'));
  }

  render(){
    this.model.webgltf = this.webgltf;
    this.scene.webgltf = this.webgltf;

    return html`
      <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons"">
      <aside ?collapsed=${this.collapsed}>
        <a class="toggle" @click="${() => this.collapsed = !this.collapsed}">
          <i class="material-icons">${this.collapsed ? 'tune' : 'close'}</i>
        </a>
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
      }

      .toggle {
        background-color: var(--primary);
        padding: 5px;
        float: right;
      }

      .controls {
        clear: both;
      }

      aside[collapsed] .toggle {
        padding: 15px;
      }

      .toggle:hover {
        background-color: var(--primary-light);
        cursor: pointer;
      }

      aside {
        max-width: 400px;
        max-height: 1000px;
        transition: max-width 0.2s ease-in-out, max-height 0.2s ease-in-out, border-radius 0.3s ease-in-out, margin 0.1s;
        overflow: hidden;
        background-color: var(--primary);
      }

      aside[collapsed] {
        margin: 15px;
        border-radius: 100%;
        max-height: 54px;
        max-width: 54px;
      }

    `;
  }
}

customElements.define('webgltf-viewer-controls', WebGLTFViewerControls);


