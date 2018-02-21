import uglify from 'rollup-plugin-uglify';

export default [{
  input: 'lib/webgltf.js',
  output: [{
    file: 'dist/webgltf.js',
    format: 'es',
    sourcemap: true,
  }, {
    file: 'dist/webgltf.umd.js',
    format: 'umd',
    name: 'gltf',
    exports: 'named',
    sourcemap: true,
  }],
}, {
  input: 'lib/webgltf.js',
  plugins: [
    uglify(),
  ],
  output: [{
    file: 'dist/webgltf.min.js',
    format: 'es',
    sourcemap: true,
  }, {
    file: 'dist/webgltf.umd.min.js',
    format: 'umd',
    name: 'gltf',
    exports: 'named',
    sourcemap: true,
  }],
}];
