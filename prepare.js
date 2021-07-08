/* eslint-env node */

/**
 * This script is used to fetch third party dependencies as ES Modules.
 * If/when these dependencies publish an ES Module (or an npm published version that works with Skypack), they will be removed from this script.
 */

import fs     from 'fs/promises';
import fetch  from 'node-fetch';
import AdmZip from 'adm-zip';

const HDRPNG_URL = 'https://enkimute.github.io/res/hdrpng.min.js';
const LIBKTX_URL = 'https://github.com/KhronosGroup/KTX-Software/releases/download/v4.0.0/KTX-Software-4.0.0-Web-libktx.zip';
const DRACO_URL  = 'https://www.gstatic.com/draco/versioned/decoders/1.4.1/draco_decoder';

async function prepareHDRPNG() {
    console.log('Preparing HDRPNG');
    const hdrpng = await fetch(HDRPNG_URL).then(res => res.text());

    await fs.writeFile('./vendor/hdrpng.js', 
`const module = { exports: {} };
${hdrpng}
const HDRImage = module.exports;
export { HDRImage };
export default HDRImage;`
    );
}

async function prepareLIBKTX() {
    console.log('Preparing LibKTX');
    const buffer = await fetch(LIBKTX_URL).then(res => res.arrayBuffer());
    const zip = new AdmZip(Buffer.from(buffer));

    const libktx = zip.readFile(zip.getEntry('libktx.js')).toString();
    zip.extractEntryTo('libktx.wasm', './vendor', false, true);

    await fs.writeFile('./vendor/libktx.js', 
`const document = { currentScript: { src: import.meta.url } };
${libktx}
export { LIBKTX };
export default LIBKTX;`
    );
}

async function prepareDraco() {
    console.log('Preparing Draco');
    const js = await fetch(`${DRACO_URL}.js`).then(res => res.text());
    const wasm = await fetch(`${DRACO_URL}.wasm`).then(res => res.buffer());

    // We shouldn't convert this to ESM until modules are supported in Web Workers.
    await fs.writeFile('./vendor/draco_decoder.js', js);
    await fs.writeFile('./vendor/draco_decoder.wasm', wasm);
}

await Promise.all([
    prepareHDRPNG(),
    prepareLIBKTX(),
    prepareDraco(),
]);
