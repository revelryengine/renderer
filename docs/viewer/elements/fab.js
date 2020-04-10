import { LitElement, html, css } from '../web_modules/lit-element.js';

import './icon.js';

class WebGLTFFAB extends LitElement {
  static get properties() {
    return {
      icon:     { type: String, reflect: true  },
      disabled: { type: Boolean, reflect: true },
    }
  }

  static get styles() {
    return css`
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 56px;
        height: 56px;
        background-color: var(--primary);
        color: var(--theme-color);
        border-radius: 56px;
        cursor: pointer;
        overflow: hidden;
        margin: 16px;
        box-shadow: var(--card-shadow-1);
        transition: all 0.3s cubic-bezier(.25,.8,.25,1);
      }

      :host(:hover) {
        background-color: var(--mono-shade2);
        box-shadow: var(--card-shadow-2);
      }

      :host(:hover:active) {
        background-color: var(--mono-shade1);
      }

      :host([disabled]) {
        cursor: default;
        pointer-events: none;
        opacity: 0.38;
        color: var(--primary-light);
      }
    `;
  }

  render(){
    return html`
      <webgltf-icon name="${this.icon}"></webgltf-icon>
    `;
  }
}

customElements.define('webgltf-fab', WebGLTFFAB);


