import { LitElement, html, css } from 'https://cdn.skypack.dev/lit-element';
import '../icon.js';

class WebGLTFViewerControlGroupElement extends LitElement {
  static get properties() {
    return {
      name: { type: String },
      collapsed: { type: Boolean, reflect: true },
    }
  }

  render(){
    return html`
      <header @click=${() => this.collapsed = !this.collapsed} ?collapsed="${this.collapsed}">
        <webgltf-icon name="chevron-down"></webgltf-icon>
        <span>${this.name}</span>
      </header>
      <main ?collapsed="${this.collapsed}">
        <div class="content">
          <slot></slot>
        </div>
      </main>
    `;
  }

  static get styles() {
    return css`
      :host {
        display: block;
        font-size: 12px;
      }

      ::slotted(*) {
        font-size: 12px;
        overflow: hidden;
      }

      header {
        padding: 10px;
        cursor: pointer;
      }

      header:hover {
        background-color: var(--mono-shade2);
      }

      header:hover:active {
        background-color: var(--mono-shade1);
      }

      header webgltf-icon {
        font-size: inherit;
        transition: transform 0.1s ease-out;
      }

      header[collapsed] webgltf-icon {
        transform: rotate(-90deg);
      }

      main {
        background-color: var(--primary-light);
        transition: max-height 0.2s ease-in-out;
        max-height: 500px;
      }

      main .content {
        display: grid;
        grid-template-columns: 50% 50%;
        grid-row-gap: 10px;
        font-size: 14px;
        padding: 10px;
      }

      main[collapsed] {
        max-height: 0px;
      }
    `;
  }
}

customElements.define('webgltf-viewer-control-group', WebGLTFViewerControlGroupElement);
