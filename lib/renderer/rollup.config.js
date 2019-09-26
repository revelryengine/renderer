import path       from 'path';
import { terser } from 'rollup-plugin-terser';

export default [
  {
    input: `lib/renderer/renderer.js`,
    output: [
      {
        file: `dist/renderer.js`,
        format: 'es',
        sourcemap: true,
      },
      {
        file: `dist/renderer.umd.js`,
        format: 'umd',
        name: 'WebGLTFRenderer',
        exports: 'named',
        sourcemap: true,
        globals: {
          [path.resolve(__dirname, '../webgltf.js')]: 'WebGLTF'
        }
      },
    ],
    external: ['../webgltf.js'],
  },
  {
    input: `lib/renderer/renderer.js`,
    plugins: [terser()],
    output: [
      {
        file: `dist/renderer.min.js`,
        format: 'es',
        sourcemap: true,
      },
      {
        file: `dist/renderer.umd.min.js`,
        format: 'umd',
        name: 'WebGLTFRenderer',
        exports: 'named',
        sourcemap: true,
        globals: {
          [path.resolve(__dirname, '../webgltf.js')]: 'WebGLTF'
        }
      },
    ],
    external: ['../webgltf.js'],
  }
];
