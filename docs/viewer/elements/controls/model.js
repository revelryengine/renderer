import { html, css } from '../../web_modules/lit-element.js';
import { WebGLTFParamElement } from './param.js';

import { GLTF_SAMPLES } from '../../web_modules/glTF-Sample-Models.js';

import './group.js';

const SAMPLES = [
  { name: '── glTF Sample Models ──', disabled: true },
  ...GLTF_SAMPLES,
  { name: '── Misc Examples ──', disabled: true },
  {
    name: 'Barrel',
    source: '',
    variants: {
      'glTF-Binary': './viewer/models/barrel.glb'
    }
  },
];

class WebGLTFViewerControlModelElement extends WebGLTFParamElement {
  static get properties() {
    return {
      sample:  { type: String, reflect: true, param: true },
      variant: { type: String, reflect: true, param: true },
      src: { type: String, reflect: true },
    }
  }

  updated() {
    this.dispatchEvent(new Event('change'));
  }

  render(){
    const sample = this.getSample();

    const { screenshot, source } = sample;

    const img = screenshot ? html`<span>Screenshot</span><span class="screenshot"><img width="50%" src="${screenshot}"></span>` : '';
    const link = source ? html`<span>Source</span><a href="${source}" target="_blank">${source}</a>` : '';

    this.src = sample.variants[this.variant] ? sample.variants[this.variant] : sample.variants[Object.keys(sample.variants)[0]];

    return html`
      <webgltf-viewer-control-group name="Model">
        <label for="sample">Sample</label>
        ${this.getSampleSelect()}
        <label for="variant">Variant</label>
        ${this.getSampleVariantSelect()}
        ${img}
        ${link}
      </webgltf-viewer-control-group>
    `;
  }

  getSample() {
    return SAMPLES.find(({ name }) => name === this.sample) || SAMPLES.find(({ name }) => name === 'SciFiHelmet');
  }

  getSampleSelect() {
    const selectedSample = this.getSample().name;
    return html`
      <select id="sample" @change="${(e) => this.sample = e.target.value}">
        ${SAMPLES.map(({ name, disabled }) => {
          return html`<option ?disabled="${disabled}" ?selected="${selectedSample === name}" value="${name}">${name}</option>`;
        })}
      </select>
    `;
  }

  getSampleVariantSelect() {
    const sample = this.getSample();
    const variants = Object.keys(sample.variants);
    const selectedVariant = sample.variants[this.variant] ? this.variant : variants[0];

    return html`
      <select id="variant" @change="${(e) => this.variant = e.target.value }}">
        ${variants.map( name => html`
          <option ?selected="${selectedVariant === name}" value="${name}">${name}</option>
        `)}
      </select>
    `;
  }

  static get styles(){
    return css`
      :host {
        display: block;
        overflow: hidden;
      }

      a {
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
        color: var(--primary-text);
      }

      a:hover {
        color: var(--primary-dark);
      }

      a:visited {
        color: var(--primary-text);
      }

      .screenshot {
        text-align: center;
      }
    `;
  }
}

customElements.define('webgltf-viewer-control-model', WebGLTFViewerControlModelElement);


