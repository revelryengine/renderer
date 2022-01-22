import { GLTFProgram } from './gltf-program.js';

import { fragmentShader } from '../../shaders/gltf/pbr.frag.js';
import { MaterialUBO    } from '../../material.js';

/**
 * @todo: Sort out the fact that switching KHR_materials_variants won't recompile so each variant must have the same texture/transform combinations.
 */

/**
 * Series of helper functions for translating glTF spec names to match their shader equivalents.
 */
 function hasTextureDefine(name) {
    return `HAS_${name.replaceAll(/([A-Z])/g, "_$1").replace(/Texture$/, 'MAP').toUpperCase()}`;
}

function hasUVTransformDefine(name) {
    return `HAS_${name.replace(/Texture$/, '_UV_TRANSFORM').toUpperCase()}`;
}

export class MaterialProgram extends GLTFProgram { 
    static #materialUBOs    = new WeakMap();
    static #defaultMaterial = {};

    static fragmentShaderSrc = fragmentShader;

    define(defines) {
        const { context: gl, primitive } = this;

        const material = primitive.getMaterial(gl);

        MaterialProgram.defineMaterial(defines, material);

        return super.define(defines);
    }

    update() {
        super.update();

        const { context: gl, primitive } = this;

        const material = primitive.getMaterial(gl);

        const ubo = MaterialProgram.getMaterialUBO(gl, material);
        ubo.bind(this);
    }

    static defineMaterial(defines, material = {}) {
        const {
            alphaMode = 'OPAQUE', pbrMetallicRoughness = {},
            normalTexture, occlusionTexture, emissiveTexture,
        } = material;

        const { baseColorTexture, metallicRoughnessTexture } = pbrMetallicRoughness;

        const textures = { normalTexture, occlusionTexture, emissiveTexture, baseColorTexture, metallicRoughnessTexture };

        for (const name in textures) {
            const texture = textures[name];
            if (texture) {
                MaterialProgram.defineTexture(defines, texture, name);
            }
        }

        Object.assign(defines, {
            ALPHAMODE_OPAQUE: 0,
            ALPHAMODE_MASK: 1,
            ALPHAMODE_BLEND: 2,
            ALPHAMODE: `ALPHAMODE_${alphaMode}`,
            MATERIAL_METALLICROUGHNESS: 1
        });

        // Check for extension definitions
        for (const extName in material.extensions) {
            const ext = material.extensions[extName];
            Object.assign(defines, ext.constructor.defines);
            for(const field of ext.constructor.textureFields) {
                const texture = ext[field];
                if(texture) this.defineTexture(defines, texture, field);
            }
        }
    }

    static defineTexture(defines, texture, name) {
        defines[hasTextureDefine(name)] = 1;

        if (texture.extensions.KHR_texture_transform) {
            defines[hasUVTransformDefine(name)] = 1;
        }
    }

    static getMaterialUBO(context, material = this.#defaultMaterial){
        return this.#materialUBOs.get(material) || this.#materialUBOs.set(material, new MaterialUBO(context, material)).get(material);
    }
}

export default MaterialProgram;