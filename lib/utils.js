import { vec3 } from '../deps/gl-matrix.js';
import { GL   } from './constants.js';

/**
 * @see https://www.w3.org/TR/WGSL/#roundup
 * @param {Number} k 
 * @param {Number} n 
 * @returns {Number}
 */
export function roundUp(k, n) {
    return Math.ceil(n / k) * k;
}

export function nearestUpperPowerOf2(v) {
    let x = v - 1;
    x |= x >> 1;
    x |= x >> 2;
    x |= x >> 4;
    x |= x >> 8;
    x |= x >> 16;
    x += 1;
    return x;
}

/**
 * Pads a 3 channel format to 4 channel format
 */
export function pad3ChannelFormat({ data, TypedArray }) {
    const texels = (data.byteLength / (3 * TypedArray.BYTES_PER_ELEMENT));
    const buffer = new ArrayBuffer(data.byteLength + (texels * TypedArray.BYTES_PER_ELEMENT));
    const padded = new TypedArray(buffer);

    for(let i = 0; i < texels; i++) {
        padded.set(new TypedArray(data.buffer, data.byteOffset + i * 3 * TypedArray.BYTES_PER_ELEMENT, 3), i * 4);
    }

    return padded;
}

/**
 * Original code from toji - https://stackoverflow.com/questions/5678432/decompressing-half-precision-floats-in-javascript
 * @param {*} h 
 * @returns 
 */
export function float16(h) {
    const s = (h & 0x8000) >> 15;
    const e = (h & 0x7C00) >> 10;
    const f = h & 0x03FF;

    if(e == 0) {
        return (s?-1:1) * Math.pow(2,-14) * (f/Math.pow(2, 10));
    } else if (e == 0x1F) {
        return f?NaN:((s?-1:1)*Infinity);
    }

    return (s?-1:1) * Math.pow(2, e-15) * (1+(f/Math.pow(2, 10)));
}


/**
 * Flips the y coordinate in a texture buffer
 */
export function flipY(buffer, bytesPerRow, rowsPerImage) {
    const result = new Uint8Array(buffer.byteLength);
    const layers = buffer.byteLength / bytesPerRow / rowsPerImage;

    const lastRow = rowsPerImage - 1;
    for(let z = 0; z < layers; z++) {
        const layerOffset = z * bytesPerRow * rowsPerImage;

        for(let y = 0; y < rowsPerImage; y++) {
            const srcOffset = layerOffset + bytesPerRow * (lastRow - y);
            const dstOffset = layerOffset + bytesPerRow * y;
            
            result.set(new Uint8Array(buffer, srcOffset, bytesPerRow), dstOffset);
        }
    }
    
    return result.buffer;
}

export function areaElement (x, y) {
    return Math.atan2(x * y, Math.sqrt(x * x + y * y + 1.0))
}

export function texelSolidAngle (aU, aV, width, height) {
    // transform from [0..res - 1] to [- (1 - 1 / res) .. (1 - 1 / res)]
    // ( 0.5 is for texel center addressing)
    const U = (2.0 * (aU + 0.5) / width) - 1.0
    const V = (2.0 * (aV + 0.5) / height) - 1.0

    // shift from a demi texel, mean 1.0 / size  with U and V in [-1..1]
    const invResolutionW = 1.0 / width
    const invResolutionH = 1.0 / height

    // U and V are the -1..1 texture coordinate on the current face.
    // get projected area for this texel
    const x0 = U - invResolutionW
    const y0 = V - invResolutionH
    const x1 = U + invResolutionW
    const y1 = V + invResolutionH
    const angle = areaElement(x0, y0) - areaElement(x0, y1) - areaElement(x1, y0) + areaElement(x1, y1)

    return angle
}


/**
 * Converts UV coordinates to cartesian coordinates for a cube face
 * Assumes Y down texture coordinates
 * @param {Number} u - u coordinate in -1:+1 range
 * @param {Number} v - v coordinate in -1:+1 range
 * @param {Number} f - Face index
 */
export function cubeCoord(u, v, f) {
    //+X, -X, +Y, -Y, +Z, -Z 
    let res;
    switch(f) {
        case 0:
            res = [ 1,-v,-u];
            break;
        case 1:
            res = [-1,-v, u];
            break;
        case 2:
            res = [ u, 1, v];
            break;
        case 3:
            res = [ u,-1,-v];
            break;
        case 4:
            res = [ u,-v, 1];
            break;
        case 5:
            res = [-u,-v,-1];
            break;
    }
    return vec3.normalize(res, res);
}

export const normalizers = {
    [GL.FLOAT]          : f => f,
    [GL.BYTE]           : c => Math.max(c / 127.0, -1.0),
    [GL.UNSIGNED_BYTE]  : c => c / 255.0,
    [GL.SHORT]          : c => Math.max(c / 32767.0, -1.0),
    [GL.UNSIGNED_SHORT] : c => c / 65535.0,
};

/**
 * Like Object.assign but deep
 */
export function merge(target, ...sources) {
    for(const source of sources) {
        for (const [key, val] of Object.entries(source)) {
            if (val !== null && typeof val === 'object') {
                if (target[key] === undefined) {
                    target[key] = new val.__proto__.constructor();
                }
                merge(target[key], val);
            } else {
                target[key] = val;
            }
        }
    }
    return target;
}

/**
 * Modified from https://gist.github.com/blixt/f17b47c62508be59987b
 */
export class PRNG {
    #seed;

    constructor(seed) {
        this.#seed = seed % 2147483647;
        if (this.#seed <= 0) this.#seed += 2147483646;
    }

    /**
     * Returns a pseudo-random value between 1 and 2^32 - 2.
     */
    next () {
        return this.#seed = this.#seed * 16807 % 2147483647;
    }

    /**
     * Returns a pseudo-random floating point number in range [0, 1).
     */
    nextFloat(opt_minOrMax, opt_max) {
        // We know that result of next() will be 1 to 2147483646 (inclusive).
        return (this.next() - 1) / 2147483646;
    }
}

export function radiansToDegrees(r) {
    return r * 180 / Math.PI;
}

export function deriveIrradianceCoefficients(data, size) {
    const coefficients = [...new Array(9)].map(() => new Float32Array(3));

    const texel = (x, y, f) => {
        const i = ((f * size * size) + ((size * y) + x)) * 4;
        return new Float32Array(data.buffer, data.byteOffset + (i * 4), 3);
    }

    let weightSum = 0;
    for(let f = 0; f < 6; f++) {
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const u = ((x + 0.5) / size) * 2.0 - 1.0;
                const v = ((y + 0.5) / size) * 2.0 - 1.0;

                const temp   = 1.0 + u * u + v * v;
                const weight = 4.0 / (Math.sqrt(temp) * temp);
                // const weight = texelSolidAngle(x, y, size, size);

                const [dx, dy, dz] = cubeCoord(u, v, f);
                const color = texel(x, y, f);

                for(let c = 0; c < 3; c++) { //this is faster than vec3 methods
                    const value = color[c] * weight;

                    //band 0
                    coefficients[0][c] += value * 0.282095;

                    //band 1
                    coefficients[1][c] += value * 0.488603 * dy;
                    coefficients[2][c] += value * 0.488603 * dz;
                    coefficients[3][c] += value * 0.488603 * dx;

                    //band 2
                    coefficients[4][c] += value * 1.092548 * dx * dy;
                    coefficients[5][c] += value * 1.092548 * dy * dz;
                    coefficients[6][c] += value * 0.315392 * (3.0 * dz * dz - 1.0);
                    coefficients[7][c] += value * 1.092548 * dx * dz;
                    coefficients[8][c] += value * 0.546274 * (dx * dx - dy * dy);  
                }
                weightSum += weight;
            }
        }
    }

    for(let c = 0; c < 9; c++) {
        vec3.scale(coefficients[c], coefficients[c], 4 * Math.PI / weightSum);
    }

    return coefficients;
}

/**
 * @param {any} target 
 * @returns {target is (WebGL2RenderingContext|import('./types.d.ts').GPUCanvasContext)}
 */
export function isRenderingContext(target) {
    //GPUCanvasContext may not be defined if browser does not support WebGPU
    return (target instanceof WebGL2RenderingContext || (globalThis.GPUCanvasContext && target instanceof globalThis.GPUCanvasContext));
}

/**
 * @param {any} target 
 * @returns {target is (HTMLCanvasElement | OffscreenCanvas)}
 */
export function isCanvas(target) {
    //OffscreenCanvas may not be defined if browser does not support it
    return (globalThis.HTMLCanvasElement && target instanceof globalThis.HTMLCanvasElement || (globalThis.OffscreenCanvas && target instanceof globalThis.OffscreenCanvas));
}

export class CanvasAutoResizer {
    #observer;
    #canvas;
    #element;
    #onresize;
    constructor({ canvas, element, renderScale = 1, onresize }) {
        element ??= canvas;

        this.#observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.target != element) { continue; }
                const { inlineSize, blockSize } = entry.devicePixelContentBoxSize[0];
                this.#resizeCanvas(inlineSize * this.renderScale, blockSize * this.renderScale);
            }
        });
        
        this.#observer.observe(element);

        this.#canvas      = canvas;
        this.#element     = element;
        this.#onresize    = onresize;
        this.#renderScale = renderScale;
    }

    #resizeCanvas(width, height) {
        if (Math.abs(width - this.#canvas.width) > 1 || Math.abs(height - this.#canvas.height) > 1) {
            this.#canvas.width  = width;
            this.#canvas.height = height;

            this.#onresize?.({ width, height });
        }
    }

    #renderScale = 1;
    get renderScale() {
        return this.#renderScale;
    }

    set renderScale(v) {
        if(this.#renderScale === v) return;
        this.#renderScale = v;
        const { width, height } = this.#element.getBoundingClientRect();
        this.#resizeCanvas(width * devicePixelRatio * this.renderScale, height * devicePixelRatio * this.renderScale);
    }

    stop() {
        this.#observer.unobserve(this.#element);
    }
}


export class CacheMap extends WeakMap {
    #subkeys = new WeakMap();

    get(...keys) {
        if(keys.length > 1) {
            const last = keys.pop();
            
            let collection = this.#subkeys;
            for(const key of keys) {
                collection = collection.get(key) ?? collection.set(key, new WeakMap()).get(key);
            }
            return collection.get(last) ?? collection.set(last, {}).get(last);
        } else {
            return super.get(keys[0]) ?? super.set(keys[0], {}).get(keys[0]);
        }
    }

    set(...keysAndValue) {
        const value = keysAndValue.pop();
        const keys  = keysAndValue;

        if(keys.length > 1) {
            const last = keys.pop();
            
            let collection = this.#subkeys;
            for(const key of keys) {
                collection = collection.get(key) ?? collection.set(key, new WeakMap()).get(key);
            }
            return collection.set(last, value);
        } else {
            return super.set(keys[0], value);
        }
    }
}

/**
 * Shim for https://github.com/tc39/proposal-array-grouping
 * @template T
 * @param {Iterable<T>} array
 * @param {(item: T, i?: Number) => (String|Number)} callback
 * @return {{[key: String|Number]: T[]}}
 */
export function groupBy(array, callback) {
    const obj = Object.create(null);

    let i = 0;
    for(const item of array) {
        const key = callback(item, i++);
        obj[key] ??= [];
        obj[key].push(item);
    }
    return obj;
}