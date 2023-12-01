/**
 * Augmentations for lib.es5.d.ts
 */

/**
 * All TypedArrays shares these properties but the built-in typescript ArrayBufferView definition does not include them so we add them here.
 *
 * There are other shared properties but we only added what was needed for this project
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray
 */
interface ArrayBufferView {
    /**
     * Sets a value or an array of values.
     * @param array A typed or untyped array of values to set.
     * @param offset The index in the current array at which the values are to be written.
     */
    set(array: ArrayLike<number>, offset?: number): void;

    /**
     * The size in bytes of each element in the array.
     */
    BYTES_PER_ELEMENT: number;

    /**
     * The length of the array.
     */
    readonly length: number;

    [index: number]: number;

}
