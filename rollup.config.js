import fetch      from 'node-fetch';
import resolve    from 'rollup-plugin-node-resolve';
import virtual    from 'rollup-plugin-virtual';
import commonjs   from 'rollup-plugin-commonjs';

function dracobase64() {
  return {
    name: 'dracobase64',
    resolveId(source) {
      try {
        const url = new URL(source);
        return url.href;
      } catch(e) {
        return null;
      }
    },
    async load(id) {
      if (/^https/.test(id)) {
        const buffer = await fetch(id).then(res => res.arrayBuffer());
        return `export default '${Buffer.from(buffer).toString('base64')}';`
      }
      return null;
    },
  }
}

export default [
  {
    input: '__virtual__',
    plugins: [
      resolve(),
      virtual({
        __virtual__: 'export * from \'gl-matrix\';',
      }),
    ],
    output: {
      file: 'vendor/gl-matrix.js',
      format: 'es',
      sourcemap: true,
    },
  },
  {
    input: '__virtual__',
    plugins: [
      virtual({
        __virtual__: `
          import HDRImage from 'https://enkimute.github.io/res/hdrpng.js';
          export { HDRImage };
          export default HDRImage;
        `,
      }),
      commonjs(),
      {
        resolveId(source) {
          try {
            const url = new URL(source);
            return url.href;
          } catch(e) {
            return null;
          }
        },
        async load(id) {
          return await fetch(id).then(res => res.text());
        }
      }
    ],
    output: {
      file: 'vendor/hdrpng.js',
      format: 'es'
    },
  },
  {
    input: '__virtual__',
    plugins: [
      virtual({
        __virtual__: `
          import wrapper from 'https://raw.githubusercontent.com/google/draco/8833cf878e6fd43c5a3fd/javascript/draco_wasm_wrapper_gltf.js';
          import wasm from 'https://raw.githubusercontent.com/google/draco/8833cf878e6fd43c5a3fd/javascript/draco_decoder_gltf.wasm';
          export { wrapper, wasm };
        `,
      }),
      dracobase64(),
    ],
    output: {
      file: 'vendor/draco-decoder.js',
      format: 'es',
      sourcemap: true,
    },
  },
  {
    input: 'lib/webgltf.js',
    output: [
      {
        file: 'dist/webgltf.js',
        format: 'es',
        sourcemap: true,
      },
    ],
  },
  {
    input: 'lib/extensions/KHR_draco_mesh_compression.js',
    output: {
      file: 'dist/extensions/KHR_draco_mesh_compression.js',
      format: 'es',
      sourcemap: true,
    },
    external: ['../webgltf.js'],
  },
];
