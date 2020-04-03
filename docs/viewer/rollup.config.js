import resolve    from 'rollup-plugin-node-resolve';
import virtual    from 'rollup-plugin-virtual';
import json       from 'rollup-plugin-json';
import urlResolve from 'rollup-plugin-url-resolve';

const BASE_SAMPLE_URL = 'https://raw.githubusercontent.com/shannon/glTF-Sample-Models/draco-patch/2.0/';
const BASE_SAMPLE_SOURCE_URL = 'https://github.com/shannon/glTF-Sample-Models/tree/draco-patch/2.0';

// const BASE_SAMPLE_URL = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/';
// const BASE_SAMPLE_SOURCE_URL = 'https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0';

export default [
  {
    input: '__virtual__',
    plugins: [
      virtual({
        __virtual__: `
          import manifest from '${BASE_SAMPLE_URL}/model-index.json';
          const BASE_SAMPLE_URL = '${BASE_SAMPLE_URL}';
          const BASE_SAMPLE_SOURCE_URL = '${BASE_SAMPLE_SOURCE_URL}';
          const GLTF_SAMPLES = manifest.map((model) => {
            const variants = Object.fromEntries(Object.entries(model.variants).map(([name, file]) => {
              return [name, \`\${BASE_SAMPLE_URL}/\${model.name}/\${name}/\${file}\`];
            }));

            const screenshot = \`\${BASE_SAMPLE_URL}/\${model.name}/\${model.screenshot}\`;
            const source = \`\${BASE_SAMPLE_SOURCE_URL}/\${model.name}\`;
            return { ...model, screenshot, variants, source };
          });
          export { GLTF_SAMPLES };
          export default GLTF_SAMPLES;
        `,
      }),
      resolve(),
      urlResolve(),
      json({ preferConst: true }),
    ],
    output: {
      file: 'web_modules/glTF-Sample-Models.js',
      format: 'es',
    },
  }
];
