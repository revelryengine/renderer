import { Program } from '../program.js';

import { vertexShader   } from '../../shaders/gltf/primitive.vert.js';
import { fragmentShader } from '../../shaders/empty.frag.js';

const INSTANCE_COUNT_MAX = 1024;

const GL = WebGL2RenderingContext;

/**
 * Series of helper functions for translating glTF spec names to match their shader equivalents.
 */
function hasAttributeDefine(name, { type }) {
    return `HAS_${name.toUpperCase()}_${type.toUpperCase()}`;
}

function hasTargetDefine(name, i, { type }) {
    return `HAS_TARGET_${name}${i}_${type.toUpperCase()}`;
}

function primitiveAttribute(name) {
    return `a_${name.toLowerCase()}`;
}

function targetAttribute(name, i) {
    return `a_target_${name.toLowerCase()}${i}`;
}


export const DEBUG_DEFINES = {
    ...Object.fromEntries([
        'DEBUG_NONE',
        'DEBUG_NORMAL',
        'DEBUG_NORMAL_WORLD',
        'DEBUG_NORMAL_GEOMETRY',
        'DEBUG_NORMAL_VIEW',
        'DEBUG_TANGENT',
        'DEBUG_BITANGENT',
        'DEBUG_ROUGHNESS',
        'DEBUG_METALLIC',
        'DEBUG_BASE_COLOR_SRGB',
        'DEBUG_BASE_COLOR_LINEAR',
        'DEBUG_OCCLUSION',
        'DEBUG_EMISSIVE_SRGB',
        'DEBUG_EMISSIVE_LINEAR',
        'DEBUG_F0',
        'DEBUG_ALPHA',
        'DEBUG_DIFFUSE_SRGB',
        'DEBUG_SPECULAR_SRGB',
        'DEBUG_CLEARCOAT_SRGB',
        'DEBUG_SHEEN_SRGB',
        'DEBUG_TRANSMISSION_SRGB',
        'DEBUG_SHADOW_CASCADE',
    ].map((name, i) => [name, i])),
    DEBUG: 'DEBUG_NONE',
}

export const TONEMAP_DEFINES = {
    'Aces Hill Exposure Boost': 'TONEMAP_ACES_HILL_EXPOSURE_BOOST',
    'Aces Narkowicz': 'TONEMAP_ACES_NARKOWICZ',
    'Aces Hill': 'TONEMAP_ACES_HILL'
}

/**
 * A standard physically based rendering program.
 */
export class GLTFProgram extends Program {

    static vertexShaderSrc   = vertexShader;
    static fragmentShaderSrc = fragmentShader;
    static uniformBindings   = { Frustum: 0, EnvironmentUBO: 1, LightingUBO: 2, MaterialUBO: 3 };

    static samplerBindings = {
        u_GGXEnvSampler:                  { unit: 0, target: GL.TEXTURE_CUBE_MAP },
        u_CharlieEnvSampler:              { unit: 1, target: GL.TEXTURE_CUBE_MAP },
        u_LambertianEnvSampler:           { unit: 2, target: GL.TEXTURE_CUBE_MAP },
        u_GGXLUT:                         { unit: 3 },
        u_CharlieLUT:                     { unit: 4 },
        u_SheenELUT:                      { unit: 5 },
        u_ShadowSamplers:                 { unit: 6, target: GL.TEXTURE_2D_ARRAY },
        u_SSAOSampler:                    { unit: 7 },
        u_TransmissionFramebufferSampler: { unit: 8 },
    }

    /**
     * Creates an instance of GLTFProgram from a {@link Primitive}.
     * @param {WebGLRenderingContext} context - The WebGL Rendering Context.
     * @param {Object} params - The GLTFProgram parameters
     */
    constructor(context, { primitive, mesh, settings, defines = {} } = {}) {
        const { attributes, targets = [] } = primitive;

        const { ibl, punctual, ssao, shadows, fog, tonemap, debug } = settings;

        defines = {
            USE_IBL:      ibl.enabled ? 1 : null,
            USE_PUNCTUAL: punctual.enabled ? 1 : null,
            USE_SHADOWS:  punctual.enabled && shadows.enabled ? 1 : null,
            USE_SSAO:     ssao.enabled ? 1 : null,
            USE_FOG:      fog.enabled ? 1 : null,

            USE_MORPHING: mesh.weights ? 1 : null,

            SHADOW_CASCADES: shadows.cascades,

            ...DEBUG_DEFINES,

            DEBUG: debug || 'DEBUG_NONE',

            ...defines,
        };

        if (TONEMAP_DEFINES[tonemap]) defines[TONEMAP_DEFINES[tonemap]] = 1;

        const maxAttributes = context.getParameter(context.MAX_VERTEX_ATTRIBS) - 1; // 1 is needed for a_instanceData
        let attributeCount = 0;
        for (const name of Object.keys(attributes)) {
            if (attributeCount++ < maxAttributes) defines[hasAttributeDefine(name, attributes[name])] = 1;
        }

        for (let i = 0; i < targets.length; i++) {
            for (const name of ['POSITION', 'NORMAl', 'TANGENT']) {
                if (targets[i][name] && attributeCount++ < maxAttributes) defines[hasTargetDefine(name, i, targets[i][name])] = 1;
            }
        }

        super(context, { defines, settings });

        this.primitive = primitive;
        this.mesh = mesh;
    }

    async compile() {
        await super.compile(...arguments);

        const { context: gl } = this;
        const vao = gl.createVertexArray();

        gl.bindVertexArray(vao);

        const { attributes, targets = [] } = this.primitive;

        for (const name in attributes) {
            const attr = attributes[name];
            this.setAccessorAttribute(primitiveAttribute(name), attr);
        }

        for (let i = 0; i < targets.length; i++) {
            for (const name of ['POSITION', 'NORMAL', 'TANGENT']) {
                if (targets[i][name]) this.setAccessorAttribute(targetAttribute(name, i), targets[i][name]);
            }
        }

        // const { instanceData, instanceDataBuffer } = this.getInstanceBuffers(gl);
        // this.attributes.set('a_instanceData', {
        //     target: gl.ARRAY_BUFFER, size: 4, type: gl.UNSIGNED_INT, normalized: false, stride: 4 * 2, divisor: 1, integer: true,
        //     buffer: instanceDataBuffer, subData: { arrayBuffer: instanceData }
        // });

        this.vao = vao;

        gl.bindVertexArray(null);
    }

    define(defines) {
        return super.define(defines);
    }

    update() {
        const { context: gl } = this;
        gl.bindVertexArray(this.vao);
    }

    setAccessorAttribute(name, accessor) {
        const { context: gl } = this;

        const {
            bufferView: { byteStride: stride = accessor.getElementSize(), target = gl.ARRAY_BUFFER } = {},
            componentType: type = gl.FLOAT, normalized = false,
        } = accessor;

        const size = accessor.getNumberOfComponents();
        const buffer = accessor.getWebGLBuffer(gl);

        this.attributes.set(name, { target, buffer, size, type, normalized, stride, offset: 0 });
    }


    run({ frustum, instances }) {
        super.run();

        this.samplers.set('u_InstanceSampler', frustum.instanceDataTexture);

        this.update();

        const { primitive } = this;

        const instanceCount = instances.length / 4;
        this.setInstanceData({ instances });
        this.drawInstances(primitive, instanceCount);
    }

    drawInstances(primitive, instanceCount) {
        const { context: gl } = this;

        const { indices, attributes, mode } = primitive;

        if (indices) {
            const { count, componentType } = indices;
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices.getWebGLBuffer(gl, gl.ELEMENT_ARRAY_BUFFER));
            gl.drawElementsInstanced(mode, count, componentType, 0, instanceCount);
        } else {
            /**
             * If indices is not defined use drawArrays instead with a count from any of the attributes. They should all be the same.
             * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#meshes
             */
            const { count } = Object.values(attributes)[0];

            gl.drawArraysInstanced(mode, 0, count, instanceCount);
        }
    }

    // static #instanceBuffers = new WeakMap();
    // static getInstanceBuffers(context) {
    //     return this.#instanceBuffers.get(context) || this.#instanceBuffers.set(context, this.createInstanceBuffers(context)).get(context);
    // }

    // static createInstanceBuffers(context) {
    //     const instanceData = new Uint32Array(INSTANCE_COUNT_MAX * 4);

    //     const gl = context;

    //     const instanceDataBuffer = gl.createBuffer();
    //     gl.bindBuffer(gl.ARRAY_BUFFER, instanceDataBuffer);
    //     gl.bufferData(gl.ARRAY_BUFFER, instanceData.byteLength, gl.DYNAMIC_DRAW);

    //     return { instanceData, instanceDataBuffer }
    // }

     #instanceBuffers = new WeakMap();
     getInstanceBuffers(context) {
        return this.#instanceBuffers.get(context) || this.#instanceBuffers.set(context, this.createInstanceBuffers(context)).get(context);
    }

     createInstanceBuffers(context) {
        const instanceData = new Uint32Array(INSTANCE_COUNT_MAX * 4);

        const gl = context;

        const instanceDataBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, instanceDataBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, instanceData.byteLength, gl.DYNAMIC_DRAW);

        return { instanceData, instanceDataBuffer }
    }

    setInstanceData({ instances }) {
        const { context: gl } = this;

        const { instanceData, instanceDataBuffer } = this.getInstanceBuffers(gl);

        instanceData.set(instances);

        // gl.bindBuffer(gl.ARRAY_BUFFER, instanceDataBuffer);
        // gl.bufferSubData(gl.ARRAY_BUFFER, 0, instanceData, 0, instances.length);

        this.attributes.set('a_instanceData', {
            target: gl.ARRAY_BUFFER, size: 4, type: gl.UNSIGNED_INT, normalized: false, stride: 4 * 4, divisor: 1, integer: true,
            buffer: instanceDataBuffer, subData: { arrayBuffer: instanceData, length: instances.length },
        });
    }
}

export default GLTFProgram;
