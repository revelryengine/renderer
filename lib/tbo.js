/// <reference path="./tbo.d.ts" />

import { TEXTURE_FORMAT, TEXTURE_USAGE } from './constants.js';

/**
 * @typedef {import('./tbo.d.ts').TBO} TBOClass
 * @typedef {import('./tbo.d.ts').TBOLayout} TBOLayoutClass
 * @typedef {import('./revgal.js').REVTexture} REVTexture
 * @typedef {import('./revgal.js').REVTextureView} REVTextureView
 */

class Region {
    static #ids = 0;

    /** @type {Region} */
    prev;

    /** @type {Region} */
    next;

    /**
     * @param {number} offset
     * @param {number} bytes
     * @param {Region} [prev]
     * @param {Region} [next]
     */
    constructor(offset, bytes, prev, next) {
        this.id     = Region.#ids++;
        this.offset = offset;
        this.bytes  = bytes;
        this.prev   = prev ?? this;
        this.next   = next ?? this;
    }
}

/**
 * circular doubly linked list
 */
class FreeList {
    #chunks = 1;
    #chunkSize;

    head;
    tail;
    start;


    /**
     * @param {number} chunkSize
     */
    constructor(chunkSize) {
        this.#chunkSize = chunkSize;

        this.head = new Region(0, chunkSize);
        this.tail = this.head;

        this.start = this.head;
    }

    /**
     * @param {number} bytes
     * @param {Region} [start]
     */
    search(bytes, start = this.start) {
        let search = start;
        do {
            if(search.bytes >= bytes) {
                this.start = search.next;
                if(!this.start) throw 'null start';
                return search;
            }
            search = search.next;
        } while (search !== start);

        return null;
    }

    /**
     * @param {Region} region
     */
    removeRegion(region) {
        if(region.next === region) { // last free region so we need to grow to avoid an empty list
            this.grow();
        }

        if(region === this.head) {
            this.head = region.next;
        }

        if(region === this.tail) {
            this.tail = region.prev;
        }

        if(region === this.start) {
            this.start = region.next;
        }

        region.prev.next = region.next;
        region.next.prev = region.prev;

        region.prev = region;
        region.next = region;
    }

    /**
     * @param {Region} region
     */
    insertRegion(region) {
        let search = this.head;
        do {
            if((search === this.head && region.offset < search.offset) || ((search.offset > region.offset) && (search.prev.offset < region.offset))) { //insert before
                region.next      = search;
                region.prev      = search.prev;
                search.prev.next = region;
                search.prev      = region;


                if(search === this.head){
                    this.head      = region;
                }
                return this.mergeRegion(region);
            }

            if((search === this.tail && region.offset > search.offset) || ((search.offset < region.offset) && (search.next.offset > region.offset))) { //insert after
                region.prev      = search;
                region.next      = search.next;
                search.next.prev = region;
                search.next      = region;

                if(search === this.tail) {
                    this.tail      = region;
                }
                return this.mergeRegion(region);
            }

            search = search.next;
        } while (search !== this.head);
    }

    /**
     * @param {Region} region
     * @param {number} bytes
     */
    splitRegion(region, bytes) {
        region.bytes -= bytes;
        const split = new Region(region.offset + region.bytes, bytes, region, region.next);

        region.next = split;

        if(region === this.tail) {
            this.tail = split;
            this.head.prev = split;
        }

        return split;
    }

    grow() {
        const region = new Region(this.#chunks * this.#chunkSize, this.#chunkSize, this.tail, this.head);

        this.head.prev = region;
        this.tail.next = region;

        this.tail = region;
        this.#chunks++;
        return this.mergeRegion(region);
    }

    /**
     * @param {Region} region
     */
    mergeRegion(region) {

        if((region.prev.offset + region.prev.bytes) === region.offset && (Math.floor(region.prev.offset / this.#chunkSize) === Math.floor(region.offset / this.#chunkSize))) {
            const { prev, next } = region;

            prev.bytes += region.bytes;

            prev.next = next;
            next.prev = prev;

            region.next = region;
            region.prev = region;

            if(region === this.tail) {
                this.tail = prev;
                this.head.prev = prev;
            }

            region = prev;
        }

        if((region.offset + region.bytes) === region.next.offset && (Math.floor(region.next.offset / this.#chunkSize) === Math.floor(region.offset / this.#chunkSize)))  {
            const { prev, next } = region;

            next.bytes += region.bytes;
            next.offset = region.offset;

            prev.next = next;
            next.prev = prev;

            region.next = region;
            region.prev = region;

            if(region === this.head) {
                this.head = next;
            }

            if(region === this.start) {
                this.start = next;
            }

            region = next;
        }

        return region;
    }
}

/**
 * @implements {TBOLayoutClass}
 */
class TBOLayout {
    /** @type {GPUTextureFormat} */
    format;

    /**
     * @param {{ width: number, height: number, limit: number, double?: boolean }} options
     */
    constructor({ width, height, limit, double }) {
        this.width  = width;
        this.height = height;
        this.limit  = limit;
        this.double = double;

        this.format = 'rgba32float';
        this.size   = { width, height, depthOrArrayLayers: limit };
        this.usage  = TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_DST | TEXTURE_USAGE.COPY_SRC;
    }

    get bytesPerRow() {
        return this.width * (TEXTURE_FORMAT[this.format]?.bytes ?? 0);
    }

    get bytesPerLayer() {
        return this.bytesPerRow * this.height;
    }
}

/**
 * @typedef {{
 *   new (gal: import('./revgal.js').RevGAL): TBO;
 *   layout: TBOLayout,
 * }} TBOConstructor
 */

/**
 * Texture Buffer Object
 */
let id = 0;

/**
 * Texture Buffer Object
 *
 * @implements {TBOClass}
 */
export class TBO {
    #free;

    /** @type {Float32Array[]} */
    layers = [];

    /** @type {[REVTexture,REVTexture]|undefined & any} */
    textures;

    /** @type {[REVTextureView,REVTextureView]|undefined & any} */
    textureViews;

    /**
     * @param {import('./revgal.js').RevGAL} gal
     */
    constructor(gal) {
        this.gal     = gal;
        this.texture = gal.device.createTexture({ label: `TBO:${this.constructor.name}:${id++}`, glArray: true, ...this.layout });
        this.textureView = this.texture.createView({ dimension: '2d-array' });

        if(this.layout.double) {
            this.textures = [
                this.texture,
                gal.device.createTexture({ label: `TBO:${this.constructor.name}:${id++}`, glArray: true, ...this.layout }),
            ];
            this.textureViews = [
                this.textureView,
                this.textures[1].createView({ dimension: '2d-array' }),
            ]
        }

        this.#free = new FreeList(this.bytesPerLayer);
    }

    get bytesPerLayer() {
        return this.layout.bytesPerLayer;
    }

    get bytesPerRow() {
        return this.layout.bytesPerRow;
    }

    get width() {
        return this.layout.width;
    }

    get height() {
        return this.layout.height;
    }

    get limit() {
        return this.layout.limit;
    }

    get layout (){
        return /** @type {TBOConstructor} */(this.constructor).layout;
    }

    /**
     * @param {number} offset
     */
    #getLayerByOffset(offset) {
        return this.layers[Math.floor(offset / (this.bytesPerLayer))];
    }

    #createLayer() {
        if(this.layers.length === this.limit) throw new Error('Texture Buffer layer limit reached');
        const layer = new Float32Array(this.bytesPerLayer / 4);
        this.layers.push(layer);
        return layer;
    }

    /**
     * @param {number} n
     */
    alloc(n) {
        const bytes = n * 4;

        let region = this.#free.search(bytes) ?? this.#free.grow();

        if(region.bytes > bytes) {
            region = this.#free.splitRegion(region, bytes);
        }

        this.#free.removeRegion(region);

        return region;
    }

    /**
     * @param {Region} region
     */
    free(region) {
        this.#free.insertRegion(region);
    }

    /**
     * Creates a view block of n number of blocks
     * @param {number} n
     * @param {Region} [region]
     * @param {number} [byteOffset]
     */
    createViewBlock(n, region = this.alloc(n), byteOffset = 0) {

        const offset = (region.offset + byteOffset);
        const layer  = this.#getLayerByOffset(offset) ?? this.#createLayer();
        const view   = new Float32Array(layer.buffer, offset % this.bytesPerLayer, n);

        return { offset, view, free: () => this.free(region) };
    }

    upload(index = 0) {
        const { bytesPerRow, width, height, layers } = this;

        const texture = this.textures?.[index] ?? this.texture;

        const layout = { offset: 0, bytesPerRow };
        const size   = { width, height };

        for (let i = 0; i < layers.length; i++) {
            const data = layers[i];
            const dest = { texture, origin: { x: 0, y: 0, z: i } };
            this.gal.device.queue.writeTexture(dest, data, layout, size);
        }

        return texture;
    }

    /**
     * @param {{ width: number, height: number, limit: number, double?: boolean }} layout
     */
    static Layout(layout) {
        return class extends TBO {
            static layout = new TBOLayout(layout);
        }
    }
}

export class MatrixTBO extends TBO {
    /**
     * @param {number} n
     */
    createMatrixViewBlock(n) {
        const region = this.alloc(n * 16);
        const views = [];
        for(let i = 0; i < n; i++) {
            const { view } = this.createViewBlock(16, region, (i * 64));
            views.push(view);
        }
        return { offset: region.offset, views, free: () => this.free(region) };
    }

    /**
     * @param {{ width: number, height: number, limit: number, double?: boolean }} layout
     */
    static Layout({ width, height, limit, double }) {
        return class extends MatrixTBO {
            static layout = new TBOLayout({ width: width * 2, height: height * 2, limit, double });
        }
    }
}
