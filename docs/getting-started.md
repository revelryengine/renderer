# Getting Started

## Quick Start - ES Module Import via CDN

```html
<canvas id="main"></canvas>
<script type="module">
  import { Renderer, WebGLTF } from 'https://unpkg.com/webgltf/dist/webgltf.min.js';

  // const renderer = new Renderer('#main');

  (async () => {
    const renderer = await Renderer.load({ target: '#main', brdf: new URL('./textures/brdfLUT.png', import.meta.url) });
    const model = await WebGLTF.load('url/to/model.gltf');
    const scene = model.scene || model.scenes[0];
    const camera = model.createCamera();
    renderer.render(scene, camera);
  })();
</script>
```

### Distributed Module Formats

WebGLTF is published to npm in standard ES and UMD format.

#### Standard ES Module bundle

- dist/webgltf.js
- dist/webgltf.min.js

#### Universal Module Definition

- dist/webgltf.umd.js
- dist/webgltf.umd.min.js

#### Standard ES Module source

- lib/webgltf.js

## About

The glTF spec is designed to be structured so there is minimal processing required before passing the binary to the GPU. 
This library takes advantage of that by making as little changes to the data structure as possible and only calling the 
relevant GPU calls when neccesary.

WebGLTF performs 3 basic tasks.

- Fetch glTF and load binary data into memory.
- Initialize array buffers and textures into a WebGL context.
- Render scene.

### Fetching data

WebGLTF simply uses the native Fetch API to load the glTF file. The binary data and images are then fetched relative to the glTF location and loaded into memory.

Images are loaded using a standard Image object which can be passed to a WebGL texture as is. This is convenient since no processing is required.

Binary data is loaded using the Fetch API and converted to a standard Array Buffer. This can also be passed directly to the GPU. Since the glTF structure allows for data types to be determined with the accessor, the array buffer is NOT converted to a specific data type before being sent to the GPU.

### Initializing data

#### Textures

WebGLTF initializes textures by uploading the image data directly to the GPU. As per the glTF spec, UNPACK_COLORSPACE_CONVERSION_WEBGL is set to NONE and UNPACK_FLIP_Y_WEBGL is set to false. All other texture parameters are pulled directly from the sampler data in the glTF file. When textures are initialized, they are bound to the TEXTURE0 index and the parameters are set. It is assumed that the textures will be bound to different indices at a later point in the render process.

#### Buffers

WebGLTF will initialize an array buffer for each glTF bufferView. The buffer is initialized using a slice of the Array Buffer that was fetched for the corresponding buffer. No data type conversion is done. As per the spec, the target is determined by the bufferView if it is defined, otherwise it is inferred from the primitive accessor. In other words if the accessor is an attribute it will use ARRAY_BUFFER, if it is the indices it will use ELEMENT_ARRAY_BUFFER.
