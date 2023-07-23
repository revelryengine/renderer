import { TEXTURE_FORMAT, TEXTURE_USAGE } from './constants.js';

class Region {
    static #ids = 0;
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

    constructor(chunkSize) {
        this.#chunkSize = chunkSize;

        this.head = new Region(0, chunkSize);
        this.tail = this.head;

        this.start = this.head;
    }

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

        region.prev = null;
        region.next = null;
    }

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

    mergeRegion(region) {
        
        if((region.prev.offset + region.prev.bytes) === region.offset && (Math.floor(region.prev.offset / this.#chunkSize) === Math.floor(region.offset / this.#chunkSize))) {
            const { prev, next } = region;

            prev.bytes += region.bytes;
            
            prev.next = next;
            next.prev = prev;

            region.next = null;
            region.prev = null;

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

            region.next = null;
            region.prev = null;

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
 * Texture Buffer Object
 */
let id = 0;
export class TBO {
    #free;
    layers = [];
    
    constructor(gal, layout = this.constructor.layout, double = this.constructor.double) {
        this.gal     = gal;
        this.layout  = layout;
        this.texture = gal.device.createTexture({ label: `TBO:${this.constructor.name}:${id++}`, array: true, ...layout });
        this.textureView = this.texture.createView({ dimension: '2d-array' });

        this.double = double;
        if(double) {
            this.textures = [
                this.texture,
                gal.device.createTexture({ label: `TBO:${this.constructor.name}:${id++}`, array: true, ...layout }),
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

    #getLayerByOffset(offset) {
        return this.layers[Math.floor(offset / (this.bytesPerLayer))];
    }

    #createLayer() {
        if(this.layers.length === this.limit) throw new Error('Texture Buffer layer limit reached');
        const layer = new Float32Array(this.bytesPerLayer / 4);
        this.layers.push(layer);
        return layer;
    }


    alloc(n) {
        const bytes = n * 4;

        let region = this.#free.search(bytes) ?? this.#free.grow();

        if(region.bytes > bytes) {
            region = this.#free.splitRegion(region, bytes);
        }

        this.#free.removeRegion(region);

        return region;
    }

    free(region) {
        this.#free.insertRegion(region);
    }

    createViewBlock(n, region, byteOffset = 0) {
        region ??= this.alloc(n);

        const offset = (region.offset + byteOffset);
        const layer  = this.#getLayerByOffset(offset) ?? this.#createLayer();
        const view   = new Float32Array(layer.buffer, offset % this.bytesPerLayer, n);

        return { offset, view, free: () => this.free(region) };
    }

    upload(index = 0) {
        const { bytesPerRow, width, height, layers } = this;

        const texture = this.double ? this.textures[index] : this.texture;

        const layout = { offset: 0, bytesPerRow };
        const size   = { width, height };

        for (let i = 0; i < layers.length; i++) {
            const data = layers[i];
            const dest = { texture, origin: { x: 0, y: 0, z: i } };
            this.gal.device.queue.writeTexture(dest, data, layout, size);
        }

        return texture;
    }

    static Layout = class TBOLayout {
        constructor({ width, height, limit }) {
            this.width  = width;
            this.height = height;
            this.limit  = limit;

            this.format = 'rgba32float';
            this.size   = { width, height, depthOrArrayLayers: limit };
            this.usage  = TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_DST | TEXTURE_USAGE.COPY_SRC;
        }

        get bytesPerRow() {
            return this.width * TEXTURE_FORMAT[this.format].bytes;
        }

        get bytesPerLayer() {
            return this.bytesPerRow * this.height;
        }
    }
}

export class MatrixTBO extends TBO {
    createMatrixViewBlock(n) {
        const region = this.alloc(n * 16);
        const views = [];
        for(let i = 0; i < n; i++) {
            const { view } = this.createViewBlock(16, region, (i * 64));
            views.push(view);
        }
        return { offset: region.offset, views, free: () => this.free(region) };
    }

    static Layout = class MatrixTBOLayout extends TBO.Layout {
        constructor({ width, height, limit }) {
            super({ width: width * 2, height: height * 2, limit }); //4 pixels per matrix
        }
    }
}

export class TBOMirror {
    constructor(source) {
        this.gal    = source.gal;
        this.source = source;

        this.texture = this.gal.device.createTexture({ label: `TBOMirror:${source.constructor.name}:${id++}`, array: true, ...source.layout });
    }

    mirror(commandEncoder) {
        commandEncoder.copyTextureToTexture({ texture: this.source.texture }, { texture: this.texture }, this.source.layout.size);
    }
}

export default TBO;