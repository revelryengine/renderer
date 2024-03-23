import { STD140_LAYOUT  } from './constants.js';
import { REVBuffer, RevGAL } from './revgal.js';

type STD140_LAYOUT_TYPE = keyof typeof STD140_LAYOUT;
type STD140_LAYOUT_TYPE_SCALAR = {[K in STD140_LAYOUT_TYPE ]: typeof STD140_LAYOUT[K]['scalar'] extends true ? K : never }[STD140_LAYOUT_TYPE];

type STD140TypedArrayConstructor = Int32ArrayConstructor | Uint32ArrayConstructor | Float32ArrayConstructor;
type STD140TypedArray = InstanceType<STD140TypedArrayConstructor>;

type STD140LayoutField = {
    type:   STD140_LAYOUT_TYPE,
    count?: number,
}

type STD140LayoutStructField = {
    type:   string,
    layout: Record<string, STD140LayoutFieldType>,
    count?: number,
}

type STD140LayoutFieldType = STD140LayoutField | STD140LayoutStructField;

type STD140LayoutStructDefinition = {
    type:   string,
    layout: STD140Layout,
}

type STD140LayoutUniformDefinition = {
    name:        string,
    type:        string,
    count:       number,
    size:        number,
    align:       number,
    scalar:      boolean,
    offset:      number,
    glsl:        string,
    TypedArray?: STD140TypedArrayConstructor
    layout?:     STD140Layout,
}

type STD140LayoutScalarViewProp     = { view: STD140TypedArray, scalar: true };
type STD140LayoutTypedArrayViewProp = { view: STD140TypedArray, scalar?: false };
type STD140LayoutStructViewProp     = { view: STD140LayoutView, scalar?: false };
type STD140LayoutArrayViewProp      = { view: (readonly STD140TypedArray[]|readonly STD140LayoutView[]), scalar?: false };
type STD140LayoutViewProp           = STD140LayoutScalarViewProp | STD140LayoutTypedArrayViewProp | STD140LayoutStructViewProp | STD140LayoutArrayViewProp;

type STD140LayoutView<T extends Record<string, STD140LayoutFieldType> = Record<string, STD140LayoutFieldType>> = {
    readonly [K in keyof T]: T[K] extends STD140LayoutStructField
        ? T[K]['count'] extends Exclude<number, 1>
            ? readonly STD140LayoutView<T[K]['layout']>[]
            : STD140LayoutView<T[K]['layout']>
        : unknown
} & {
    readonly [K in keyof T]: T[K] extends { type: Exclude<STD140_LAYOUT_TYPE, STD140_LAYOUT_TYPE_SCALAR> }
        ? T[K]['count'] extends Exclude<number, 1>
            ? InstanceType<typeof STD140_LAYOUT[T[K]['type']]['TypedArray']>[]
            : InstanceType<typeof STD140_LAYOUT[T[K]['type']]['TypedArray']>
        : unknown
} & {
    [K in keyof T]: T[K] extends { type: STD140_LAYOUT_TYPE_SCALAR }
        ? T[K]['count'] extends Exclude<number, 1>
            ? InstanceType<typeof STD140_LAYOUT[T[K]['type']]['TypedArray']>
            : number
        : unknown
} & {
    set(values: STD140LayoutValueSetter<T>): void;
}

type STD140LayoutValueSetter<T extends Record<string, STD140LayoutFieldType> = Record<string, STD140LayoutFieldType>> = {
    [K in keyof T]?: T[K] extends STD140LayoutStructField
        ? T[K]['count'] extends Exclude<number, 1>
            ? STD140LayoutValueSetter<T[K]['layout']>[]
            : STD140LayoutValueSetter<T[K]['layout']>
        : unknown
} & {
    [K in keyof T]?: T[K] extends { type: Exclude<STD140_LAYOUT_TYPE, STD140_LAYOUT_TYPE_SCALAR> }
        ? T[K]['count'] extends Exclude<number, 1>
            ? InstanceType<typeof STD140_LAYOUT[T[K]['type']]['TypedArray']>[] | ArrayLike<number>[]
            : InstanceType<typeof STD140_LAYOUT[T[K]['type']]['TypedArray']> | ArrayLike<number>
        : unknown
} & {
    [K in keyof T]?: T[K] extends { type: STD140_LAYOUT_TYPE_SCALAR }
        ? T[K]['count'] extends Exclude<number, 1>
            ? InstanceType<typeof STD140_LAYOUT[T[K]['type']]['TypedArray']> | ArrayLike<number>
            : number
        : unknown
}

declare class STD140Layout<T extends Record<string, STD140LayoutFieldType> = Record<string, STD140LayoutFieldType>> {
    constructor(uniforms: T);

    size:     number;
    usage:    number;
    uniforms: STD140LayoutUniformDefinition[];
    structs:  STD140LayoutStructDefinition[];

    /**
     * Creats a struct view mapped to the underlying buffer
     */
    createView(object: object, buffer: ArrayBuffer, parentOffset?: number): STD140LayoutView<T>;
}

type UBOConstructor<T extends Record<string, STD140LayoutFieldType> = Record<string, STD140LayoutFieldType>> = {
    new (gal: import('./revgal.js').RevGAL, values?: STD140LayoutValueSetter<T>): InstanceType<typeof UBO<T>> & STD140LayoutView<T>;

    /**
     * The STD140 layout used to define the memory layout of the struct on the GPU.
     */
    layout: STD140Layout<T>;

    /**
     * Default values to set during instantiation.
     */
    defaults?: STD140LayoutValueSetter<T>;

    generateUniformBlock(type: 'wgsl'|'glsl', group: number|string, binding: number|string, name?: string): string;
}


/**
 * A UBO is a class abstraction around Uniform Buffer objects to be used in WebGPU/WebGL2.
 * It works by creating ArrayBufferViews on a larger buffer.
 * The object can be modified using standard properties and then uploaded at the start of a render call.
 */
export declare class UBO<T extends Record<string, STD140LayoutFieldType> = Record<string, STD140LayoutFieldType>> {
    constructor(gal: import('./revgal.js').RevGAL, values?: STD140LayoutValueSetter<T>)

    name:   string;

    gal:    RevGAL;
    buffer: REVBuffer;
    data:   Uint8Array;

    set(values: STD140LayoutValueSetter<T>): void;

    /**
     * Uploads the buffer to the GPU
     */
    upload(): void;

    /**
     * The STD140 layout used to define the memory layout of the struct on the GPU. This is an alias to the UBOConstructor.layout
     */
    layout: STD140Layout<T>;

    /**
     * Default values to set during instantiation. This is an alias to the UBOConstructor.defaults
     */
    defaults?: STD140LayoutValueSetter<T>;


    /**
     * Retruns a mat3x3 aligned to support std140 layout.
     */
    static std140Mat3(mat: mat4): Float32Array

    /**
     * A factory function to created a Typed class with the specified layout and default values.
     *
     * @param layout - The layout definition to create the STD140Layout with
     * @param defaults - The Default values to set during instantiation
     */
    static Layout<T extends Record<string, STD140LayoutFieldType>>(layout: T, defaults?: STD140LayoutValueSetter<T>): UBOConstructor<T>;

    static generateUniformBlock(type: 'wgsl'|'glsl', group: number|string, binding: number|string, name?: string): string;
    generateUniformBlock(group: number|string, binding: number|string, name?: string): string;
}
