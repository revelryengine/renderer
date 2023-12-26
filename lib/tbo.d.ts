import { REVTexture, REVTextureView, RevGAL } from './revgal.js';

type TBOLayoutDefinition = {
    width: number,
    height: number,
    limit: number,
    double?: boolean
}

type Region = {
    id:     number;
    offset: number;
    bytes:  number;
    prev:   Region;
    next:   Region;
}

declare class TBOLayout {
    constructor(options: { width: number, height: number, limit: number, double?: boolean })

    readonly width:   number;
    readonly height:  number;
    readonly limit:   number;
    readonly double?: boolean;
    readonly format:  GPUTextureFormat;
    readonly size:    GPUExtent3DDict;
    readonly usage:   GPUTextureUsageFlags;

    readonly bytesPerRow:   number;
    readonly bytesPerLayer: number;
}

type TBOConstructor<T extends TBOLayoutDefinition = TBOLayoutDefinition> = {
    new (gal: import('./revgal.js').RevGAL): TBO<T>;
    /**
     * The layout used to define the memory layout of the texture on the GPU.
     */
    layout: TBOLayout;
}

export declare class TBO<T extends TBOLayoutDefinition = TBOLayoutDefinition> {
    constructor(gal: RevGAL);
    readonly gal:         RevGAL;
    readonly texture:     REVTexture;
    readonly textureView: REVTextureView;

    readonly textures:     T['double'] extends true ? [REVTexture, REVTexture] : undefined;
    readonly textureViews: T['double'] extends true ? [REVTextureView, REVTextureView] : undefined;

    readonly bytesPerRow:   number;
    readonly bytesPerLayer: number;
    readonly width:         number;
    readonly height:        number;
    readonly limit:         number;
    readonly layout:       TBOLayout;


    alloc(n: number): Region;

    /**
     * @param {Region} region
     */
    free(region: Region): void

    /**
     * Creates a view block of n number of blocks
     */
    createViewBlock(n: number, region?: Region, byteOffset?: number): { offset: number, view: Float32Array, free: () => void }


    upload(index?: number): REVTexture;

    /**
     * A factory function to created a Typed class with the specified layout and default values.
     *
     * @param layout - The layout definition to create the STD140Layout with
     * @param defaults - The Default values to set during instantiation
     */
    static Layout<T extends TBOLayoutDefinition>(layout: T): TBOConstructor<T>;
}

type MatrixTBOConstructor<T extends TBOLayoutDefinition = TBOLayoutDefinition> = {
    new (gal: import('./revgal.js').RevGAL): MatrixTBO<T>;
    /**
     * The layout used to define the memory layout of the texture on the GPU.
     */
    layout: TBOLayout;
}

export declare class MatrixTBO<T extends TBOLayoutDefinition = TBOLayoutDefinition> extends TBO<T> {
    createMatrixViewBlock(n: number): { offset: number, views: Float32Array[], free: () => void }
    static Layout<T extends TBOLayoutDefinition>(layout: T): MatrixTBOConstructor<T>;
}
