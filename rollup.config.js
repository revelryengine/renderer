import resolve  from 'rollup-plugin-node-resolve';
import virtual  from 'rollup-plugin-virtual';
import uglify   from 'rollup-plugin-uglify';

export default [
  {
    input: '__virtual__',
    plugins: [
      virtual({
        __virtual__: 'export * from \'gl-matrix\';',
      }),
      resolve(),
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
        name: 'gltf',
        exports: 'named',
        sourcemap: true,
      },
    ],
  }, {
    input: 'lib/webgltf.js',
    plugins: [
      uglify(),
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
        name: 'gltf',
        exports: 'named',
        sourcemap: true,
      },
    ],
  },
];
