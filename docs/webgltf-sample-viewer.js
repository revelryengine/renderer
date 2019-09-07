import './webgltf-viewer.js';

const baseSampleUrl = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/';

export class WebGLTFSampleViewer extends HTMLElement {
  constructor() {
    super();
    this.viewer = document.createElement('webgltf-viewer');
    const camera = this.querySelector('webgltf-camera');
    if (camera) this.viewer.appendChild(camera);

    this.header = this.appendChild(document.createElement('h3'));
    this.appendChild(this.viewer);
  }

  connectedCallback() {

  }

  async attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'model') {
      this.viewer.setAttribute('src', `${baseSampleUrl}/${newValue}/glTF/${newValue}.gltf`);
      this.header.innerText = newValue;
    }
  }

  static get observedAttributes() { return ['model']; }
}


customElements.define('webgltf-sample-viewer', WebGLTFSampleViewer);

export default WebGLTFSampleViewer;

