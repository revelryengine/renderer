import { GLTFProperty } from './gltf-property.js';

/**
 * Reference to a morphTarget.
 * @typedef {glTFProperty} morphTarget
 * @property {Number} NORMAL - The index of the Accessor containing XYZ vertex normal displacements.
 * @property {Number} [POSITION] - The index of the Accessor containing XYZ vertex position displacements.
 * @property {Number} [TANGENT] - The index of the Accessor containing XYZ vertex tangent displacements.
 *
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#morph-targets
 */

/**
 * A class wrapper around the glTF morphTarget object.
 */
export class MorphTarget extends GLTFProperty {
    /**
     * Creates an instance of MorphTarget.
     * @param {morphTarget} morphTarget - The properties of the morphTarget.
     */
    constructor(morphTarget) {
        super(morphTarget);

        const { NORMAL, POSITION, TANGENT } = morphTarget;

        /**
         * The Accessor or the index of the Accessor containing XYZ vertex normal displacements.
         * @type {Number|Accessor}
         */
        this.NORMAL = NORMAL;

        /**
         * The Accessor or the index of the Accessor containing XYZ vertex position displacements.
         * @type {Number|Accessor}
         */
        this.POSITION = POSITION;

        /**
         * The Accessor or the index of the Accessor containing XYZ vertex tangent displacements.
         * @type {Number|Accessor}
         */
        this.TANGENT = TANGENT;
    }

    static referenceFields = [
        { name: 'NORMAL',   type: 'collection', collection: 'accessors' },
        { name: 'POSITION', type: 'collection', collection: 'accessors' },
        { name: 'TANGENT',  type: 'collection', collection: 'accessors' },
    ];
}

export default MorphTarget;
