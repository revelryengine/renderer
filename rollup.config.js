import resolve  from 'rollup-plugin-node-resolve';
import virtual  from 'rollup-plugin-virtual';
import uglify   from 'rollup-plugin-uglify';
import replace  from 'rollup-plugin-replace';

export default [
  {
    input: '__virtual__',
    plugins: [
      virtual({
        __virtual__: 'export * from \'gl-matrix\';',
      }),
      resolve(),
      replace({ // patch for https://github.com/toji/gl-matrix/issues/269
        include: 'node_modules/gl-matrix/**',
        values: {
          'mat4.identity(': 'identity(',
        },
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
        name: 'webgltf',
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
        name: 'webgltf',
        exports: 'named',
        sourcemap: true,
      },
    ],
  },
];
