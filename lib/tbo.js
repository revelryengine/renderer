import { TEXTURE_FORMAT, TEXTURE_USAGE } from './constants.js';

/**
 * Texture Buffer Object
 */
let id = 0;
export class TBO {
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
    }

    get format() {
        return this.layout.format;
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

    getLayerByIndex(index) {
        const i = Math.floor(index / (this.width * this.height));
        return this.layers[i];
    }

    createLayer() {
        if(this.layers.length === this.limit) throw new Error('Texture Buffer layer limit reached');
        const layer = new Float32Array(this.bytesPerLayer / 4);
        this.layers.push(layer);
        return layer;
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
        constructor({ format = 'rgba32float', width, height, limit }) {
            this.width  = width;
            this.height = height;
            this.limit  = limit;

            this.format = format;
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
    #currentIndex     = 0;
    #recycled         = [];
    #recycledBlocks   = [];
    #matricesPerLayer = this.bytesPerLayer / 64;

    createMatrixView() {
        // if (this.#recycled.length) {
        //     return this.#recycled.pop();
        // }

        const index      = this.#currentIndex;
        const layer      = this.getLayerByIndex(index * 4) ?? this.createLayer();
        const offset     = this.#currentIndex % this.#matricesPerLayer;
        const matrixView = new Float32Array(layer.buffer, offset * 64, 64);

        this.#currentIndex++ ;

        return { index, matrixView };
    }

    createMatrixViewBlock(n) {
        // for(const { index, block } of this.#recycledBlocks) {
        //     if(block.length >= n) {
        //         if(block.length > n) {
        //             this.recycleMatrixViewBlock(block.slice(n));
        //             return block.slice(0, n);
        //         }
        //     }
        // }
        const block = [];
        for(let i = 0; i < n; i++) {
            block.push(this.createMatrixView());
        }
        return { index: block[0].index, block };
    }

    // recycleMatrixView(matrixView) {
    //     this.#recycled.push(matrixView);
    // }

    // recycleMatrixViewBlock(block) {
    //     this.#recycledBlocks.push(block);
    //     this.#recycledBlocks.sort((a, b) => a.length - b.length);
    // }

    // shrink() {
    //     while (this.#recycled.length && this.#recycled[this.#recycled.length - 1].index === this.#currentIndex) {
    //         this.#recycled.pop();
    //         this.#currentIndex--;
    //     }
    //     this.layers.length = Math.floor(this.#currentIndex / this.#matricesPerLayer) + 1;
    // }

    static Layout = class MatrixTBOLayout extends TBO.Layout {
        constructor({ width, height, limit }) {
            super({ format: 'rgba32float', width: width * 4, height: height * 4, limit }); //4 pixels per matrix
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