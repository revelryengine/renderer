import resolve    from 'rollup-plugin-node-resolve';
import virtual    from 'rollup-plugin-virtual';
import { terser } from 'rollup-plugin-terser';

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
    input: 'lib/webgltf.js',
    output: [
      {
        file: 'dist/webgltf.js',
        format: 'es',
        sourcemap: true,
      },
      {
        file: 'dist/webgltf.umd.js',
        format: 'umd',
        name: 'WebGLTF',
        exports: 'named',
        sourcemap: true,
      },
    ],
  }, {
    input: 'lib/webgltf.js',
    plugins: [
      terser(),
    ],
    output: [
      {
        file: 'dist/webgltf.min.js',
        format: 'es',
        sourcemap: true,
      },
      {
        file: 'dist/webgltf.umd.min.js',
        format: 'umd',
        name: 'WebGLTF',
        exports: 'named',
        sourcemap: true,
      },
    ],
  },
];
