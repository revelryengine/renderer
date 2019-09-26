import path       from 'path';
import virtual    from 'rollup-plugin-virtual';
import { terser } from 'rollup-plugin-terser';
import urlResolve from 'rollup-plugin-url-resolve';
import inject     from 'rollup-plugin-inject';

/**
 * @todo glob this from the directory
 */
const EXTENSIONS = ['KHR_lights_punctual', 'KHR_draco_mesh_compression'];

export default [
  {
    input: '__virtual__',
    plugins: [
      inject({
        exports: '__exports__'
      }),
      virtual({
        __exports__: 'export default {};',
        __virtual__: `
          import __exports__ from '__exports__';
          import 'https://raw.githubusercontent.com/google/draco/8833cf878e6fd43c5a3fd/javascript/draco_decoder.js';
          const { DracoDecoderModule } = __exports__;
          export { DracoDecoderModule };
        `,
      }),
      urlResolve(),
    ],
    output: {
      file: 'vendor/draco-decoder.js',
      format: 'es',
      sourcemap: true,
    },
  },
  ...EXTENSIONS.map(name => {
    return {
      input: `lib/extensions/${name}.js`,
      output: [
        {
          file: `dist/extensions/${name}.js`,
          format: 'es',
          sourcemap: true,
        },
        {
          file: `dist/extensions/${name}.umd.js`,
          format: 'umd',
          name,
          exports: 'named',
          sourcemap: true,
          globals: {
            [path.resolve(__dirname, '../webgltf.js')]: 'WebGLTF'
          }
        },
      ],
      external: ['../webgltf.js'],
    }
  }),
  ...EXTENSIONS.map(name => {
    return {
      input: `lib/extensions/${name}.js`,
      plugins: [terser()],
      output: [
        {
          file: `dist/extensions/${name}.min.js`,
          format: 'es',
          sourcemap: true,
        },
        {
          file: `dist/extensions/${name}.umd.min.js`,
          format: 'umd',
          name,
          exports: 'named',
          sourcemap: true,
          globals: {
            [path.resolve(__dirname, '../webgltf.js')]: 'WebGLTF'
          }
        },
      ],
      external: ['../webgltf.js'],
    }
  }),
];
