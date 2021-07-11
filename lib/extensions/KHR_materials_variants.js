import { extensions   } from '../extensions.js';
import { GLTFProperty } from '../gltf-property.js';

/**
 * @see https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_variant
 */

/**
 * @typedef {glTFProperty} khrMaterialsVariantsVariant
 * @property {String} name - The name of the material variant.
 */

/**
 * A class wrapper for the material khrMaterialsVariantsVariant object.
 */
export class KHRMaterialsVariantsVariant extends GLTFProperty {
  #active = new WeakMap();
  /**
   * Creates an instance of KHRMaterialsVariantsVariant.
   * @param {khrMaterialsVariantsVariant} khrMaterialsVariantsVariant - The properties of the KHR_materials_variant variant object.
   */
  constructor(khrMaterialsVariantsVariant) {
    super(khrMaterialsVariantsVariant);

    const { name } = khrMaterialsVariantsVariant;

    /**
     * The name of the material variant.
     * @type {String}
     */
    this.name = name;
  }

  /**
   * Activates the variant for the given context
   */
  activate(context) {
    this.#active.set(context, true);
  }

  /**
   * Deactivates the variant for the given context
   */
  deactivate(context) {
    this.#active.delete(context);
  }

  /**
   * Checks if the variant is active for the given context
   */
  isActive(context) {
    return this.#active.get(context);
  }
}

/**
 * KHR_materials_variant gltf extension
 * @typedef {glTFProperty} khrMaterialsVariantsGLTF
 * @property {khrMaterialsVariants[]} variants - An array of objects defining a valid material variant.
 */

/**
 * A class wrapper for the material khrMaterialsVariantsGLTF object.
 */
export class KHRMaterialsVariantsGLTF extends GLTFProperty {
  /**
   * Creates an instance of KHRMaterialsVariantsGLTF.
   * @param {khrMaterialsVariantsGLTF} khrMaterialsVariantsGLTF - The properties of the KHR_materials_variant gltf extension.
   */
  constructor(khrMaterialsVariantsGLTF) {
    super(khrMaterialsVariantsGLTF);

    const { variants } = khrMaterialsVariantsGLTF;

    /**
     * An array of objects defining a valid material variant.
     * @type {KHRMaterialsVariantsVariant[]}
     */
    this.variants = variants.map(variant => new KHRMaterialsVariantsVariant(variant));
  }
}

/**
 * KHR_materials_variant primitive extension mapping
 * @typedef {glTFProperty} khrMaterialsVariantsPrimitiveMapping
 * @property {Number[]} variants - An array of index values that reference variants defined in the glTF root's extension object.
 * @property {Number} material - A reference to the material associated with the given array of variants.
 * @property {String} [name] - The optional user-defined name of this variant material mapping.  This is not necessarily unique.
 */

/**
 * A class wrapper for the material khrMaterialsVariantsPrimitive object.
 */
export class KHRMaterialsVariantsPrimitiveMapping extends GLTFProperty {
  /**
   * Creates an instance of KHRMaterialsVariantsPrimitive.
   * @param {khrMaterialsVariantsPrimitiveMapping} khrMaterialsVariantsPrimitiveMapping - The properties of the KHR_materials_variant primitive extension.
   */
  constructor(khrMaterialsVariantsPrimitiveMapping) {
    super(khrMaterialsVariantsPrimitiveMapping);

    const { variants, material, name } = khrMaterialsVariantsPrimitiveMapping;

    /**
     * An array of variants or indexx values that reference variants defined in the glTF root's extension object.
     * @type {Number[]|Variant[]}
     */
    this.variants = variants;

    /**
     * The Material or the index of the Material associated with the given array of variants.
     * @type {Number|Material}
     */
    this.material = material;

    /**
     * The optional user-defined name of this variant material mapping.  This is not necessarily unique.
     * @type {String}
     */
    this.name = name;
  }

  static referenceFields = [
    { name: 'variants', type: 'collection', collection: ['extensions', 'KHR_materials_variants', 'variants'] },
    { name: 'material', type: 'collection', collection: 'materials' },
  ];
}

/**
 * KHR_materials_variant primitive extension
 * @typedef {glTFProperty} khrMaterialsVariantsPrimitive
 * @property {khrMaterialsVariantsPrimitiveMapping[]} mappings - An array of object values that associate an indexed material to a set of variants.
 */

/**
* A class wrapper for the material khrMaterialsVariantsPrimitive object.
*/
export class KHRMaterialsVariantsPrimitive extends GLTFProperty {
  /**
   * Creates an instance of KHRMaterialsVariantsPrimitive.
   * @param {khrMaterialsVariantsPrimitive} khrMaterialsVariantsPrimitive - The properties of the KHR_materials_variant primitive extension.
   */
  constructor(khrMaterialsVariantsPrimitive) {
    super(khrMaterialsVariantsPrimitive);

    const { mappings } = khrMaterialsVariantsPrimitive;

    /**
     * A list of material to variant mappings
     * @type {KHRMaterialsVariantsPrimitiveMapping[]}
     */
    this.mappings = mappings.map(mapping => new KHRMaterialsVariantsPrimitiveMapping(mapping));
  }

  getMaterial(context, primitive) {
    const activeMaterial = this.mappings.find(mapping => {
      return mapping.variants.some(variant => variant.isActive(context));
    });
    return activeMaterial?.material || primitive.material;
  }

  static referenceFields = [
    { name: 'mappings', type: 'sub' },
  ];
}

extensions.set('KHR_materials_variants', {
  schema: {
    WebGLTF: KHRMaterialsVariantsGLTF,
    Primitive: KHRMaterialsVariantsPrimitive,
  },
});
