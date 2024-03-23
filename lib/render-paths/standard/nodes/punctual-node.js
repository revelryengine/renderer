import { LIGHT_TYPES } from '../../../constants.js';
import { Frustum     } from '../../../frustum.js';
import { UBO         } from '../../../ubo.js';

import { GLTFNode   } from '../../common/nodes/gltf-node.js';
import { GLTFShader } from '../../common/shaders/gltf-shader.js';

import { vec3, vec4, mat4, quat } from '../../../../deps/gl-matrix.js';

/**
 * A unit cube in WebGL coordinates
 */
 const FRUSTUM_CUBE = [
    [-1, 1,-1, 1],
    [ 1, 1,-1, 1],
    [ 1,-1,-1, 1],
    [-1,-1,-1, 1],
    [-1, 1, 1, 1],
    [ 1, 1, 1, 1],
    [ 1,-1, 1, 1],
    [-1,-1, 1, 1],
];

class ShadowGLTFShader extends GLTFShader {
    getFlags() {
        const flags = super.getFlags();
        return {
            ...flags,
            shadowPass: true,

            useShadows:      false,
            usePunctual:     false,
            useEnvironment:  false,
            useTransmission: false,
            useSSAO:         false,

            debug: null,

            colorTargets: {
                //none
            }
        }
    }
}

/**
 * @typedef {{
 *  lightType:    number,
 *  color:        vec3,
 *  intensity:    number,
 *  range:        number,
 *  position:     vec3,
 *  innerConeCos: number,
 *  outerConeCos: number,
 *  direction:    vec3,
 * }} LightStruct
 */

/**
 * The Punctual Node is responsible for uploading all the punctual lighting information
 * @extends {GLTFNode<{
 *  output: {
 *      punctual:       import('../../../punctual.js').Punctual,
 *      shadowsSampler: import('../../../revgal.js').REVSampler,
 *  }
 * }>}
 */
export class PunctualNode extends GLTFNode {
    Shader = ShadowGLTFShader;

    size = { width: 2048, height: 2048 };

    layers = 6;

    opaque = true;

    /**
     * @type {import('../../../punctual.js').Punctual|null}
     */
    punctual = null;

    /**
     * @param {import('../../render-path.js').RenderPath} renderPath
     */
    constructor(renderPath) {
        super(renderPath);

        this.enableAttachments('depth');
    }

    /**
     * @type {GLTFNode['passData']|null}
     */
    #passData = null;
    get passData() {
        return this.#passData ?? super.passData;
    }

    /**
     * @type {GLTFNode['getBindGroupEntries']}
     */
    getBindGroupEntries( ){
        return null;
    }

    reconfigure(){
        const settings = /** @type {import('../standard-settings.js').StandardSettings} */(this.renderPath.settings);

        this.punctual = new (class Punctual extends UBO.Layout({
            lights: { count: Math.max(settings.flags.maxLights, 2), type: 'Light', layout: {
                    position:     { type: 'vec3<f32>' },
                    direction:    { type: 'vec3<f32>' },
                    color:        { type: 'vec3<f32>' },

                    range:        { type: 'f32'       },
                    intensity:    { type: 'f32'       },

                    innerConeCos: { type: 'f32'       },
                    outerConeCos: { type: 'f32'       },

                    lightType:    { type: 'i32'       },
                    shadowLayer:  { type: 'i32'       },
                },
            },
            lightCount:          { type: 'i32'       },
            shadowCount:         { type: 'i32'       },
            shadowCascadeCount:  { type: 'i32'       },
            shadowCascadeDepths: { type: 'vec4<f32>' },
            shadowMatrices:      { type: 'mat4x4<f32>', count: Math.max(settings.flags.maxShadows, 2)  },
        }){
            maxLights  = Math.max(settings.flags.maxLights, 2);
            maxShadows = Math.max(settings.flags.maxShadows, 2);
        })(this.gal);

        this.output.punctual = this.punctual;

        this.output.shadowsSampler = this.gal.device.createSampler({ minFilter: 'linear', magFilter: 'linear', compare: 'less' });

        super.reconfigure();
    }

    /**
     * @type {GLTFNode['run']}
     *
     * @this {this & { punctual: import('../../../punctual.js').Punctual, settings: import('../standard-settings.js').StandardSettings }}
     */
    run(commandEncoder) {
        const { graph, frustum } = this.passData;

        this.punctual.lightCount = Math.min(graph.lights.size, this.punctual.lights.length);

        let i = 0;
        for(const light of graph.lights) {
            if(i >= this.punctual.lightCount) break;
            this.punctual.lights[i++].set(this.getLightUniformStruct(light));
        }

        if(!this.settings.flags.shadows) return this.punctual.upload();

        const settings = this.settings.values.shadows;

        const { near, far } = frustum;

        this.punctual.shadowCascadeDepths.set(PunctualNode.calculateCascadeDepths(near, far, settings.lambda, settings.cascades));
        this.punctual.shadowCascadeCount  = settings.cascades;

        const splits = [near, ...this.punctual.shadowCascadeDepths.slice(0, settings.cascades - 1), far];

        let layer = 0;
        for(let i = 0, l = this.punctual.lightCount; i < l; i++) {
            const light = this.punctual.lights[i];

            switch(light.lightType) {
                case LIGHT_TYPES.directional: {
                    light.shadowLayer = layer;
                    for(let i = 0; i < settings.cascades; i++) {
                        const shadowFrustum = this.getShadowFrustum(light, frustum, splits[i], splits[i + 1]);
                        const instances     = graph.generateInstances({ frustum: shadowFrustum });

                        this.#passData = { ...super.passData, frustum: shadowFrustum, instances }
                        this.setRenderLayer(layer + i);
                        super.run(commandEncoder);

                        this.setShadowMatrix(this.punctual.shadowMatrices[layer + i], shadowFrustum);
                    }
                    layer += settings.cascades;
                    break;
                }
                case LIGHT_TYPES.spot: {
                    light.shadowLayer = layer;
                    const shadowFrustum = this.getShadowFrustum(light, frustum);
                    const instances = graph.generateInstances({ frustum: shadowFrustum });

                    this.#passData = { ...super.passData, frustum: shadowFrustum, instances }
                    this.setRenderLayer(layer);
                    super.run(commandEncoder);

                    this.setShadowMatrix(this.punctual.shadowMatrices[layer], shadowFrustum);
                    layer++;
                    break;
                }
            }
        }

        this.#passData = null;

        this.punctual.shadowCount = layer;
        this.punctual.upload();
    }

    #spotShadowFrustums        = new WeakMap();
    #directionalShadowFrustums = new WeakMap();

    /**
     * @overload
     * @param {LightStruct & { lightType: LIGHT_TYPES['spot']}} light
     * @param {import('../../../frustum.js').Frustum} frustum
     * @return {Frustum}
     *
     * @overload
     * @param {LightStruct & { lightType: LIGHT_TYPES['directional']}} light
     * @param {import('../../../frustum.js').Frustum} frustum
     * @param {number} near
     * @param {number} far
     * @return {Frustum}
     *
     * @param {LightStruct} light
     * @param {import('../../../frustum.js').Frustum} frustum
     * @param {number} [near]
     * @param {number} [far]
     */
    getShadowFrustum(light, frustum, near = 0, far = 0) {
        let shadowFrustum, transform, projectionMatrix;

        if(light.lightType === LIGHT_TYPES.spot) {
            shadowFrustum = this.#spotShadowFrustums.get(light) ?? this.#spotShadowFrustums.set(light, new Frustum(this.gal, this.size)).get(light);

            const point = vec3.add(vec3.create(), light.position, light.direction);

            transform = mat4.create();

            mat4.targetTo(transform, light.position, point, vec3.fromValues(0, 1, 0));

            projectionMatrix = this.getProjectionMatrix({
                type: 'perspective',
                yfov: Math.acos(light.outerConeCos) * 2,
                zfar: light.range,
                znear: 0.1,
            });
        } else if(light.lightType === LIGHT_TYPES.directional) {
            const shadowFrustums = this.#directionalShadowFrustums.get(light) ?? this.#directionalShadowFrustums.set(light, {}).get(light);

            shadowFrustum = shadowFrustums[near] ?? (shadowFrustums[near] = new Frustum(this.gal, this.size));

            const { center, radius } = PunctualNode.calculateBoundingSphere(frustum, near, far);

            const texelsPerUnit = this.size.width / (radius * 2);

            const scalar     = mat4.fromScaling(mat4.create(), vec3.fromValues(texelsPerUnit, texelsPerUnit, texelsPerUnit));
            const zero       = vec3.create();
            const up         = vec3.fromValues(0, 1, 0);
            const lookAt     = mat4.create();
            const lookAtInv  = mat4.create();
            const baseLookAt = vec3.fromValues(-light.direction[0], -light.direction[1], -light.direction[2]);

            mat4.lookAt(lookAt, zero, baseLookAt, up);
            mat4.mul(lookAt, lookAt, scalar);
            mat4.invert(lookAtInv, lookAt);

            vec3.transformMat4(center, center, lookAt);
            center[0] = Math.floor(center[0]);
            center[1] = Math.floor(center[1]);
            vec3.transformMat4(center, center, lookAtInv);

            const eye = vec3.sub(vec3.create(), center, vec3.scale(vec3.create(), light.direction, radius * 2));

            transform = mat4.create();

            mat4.targetTo(transform, eye, center, up);

            projectionMatrix = this.getProjectionMatrix({
                type: 'orthographic',
                znear: -radius * 4,
                zfar:  radius * 4,
                xmag:  radius,
                ymag:  radius,
            });
        }

        shadowFrustum.update({ transform, projectionMatrix });
        shadowFrustum.upload();
        return shadowFrustum;
    }

    /**
     * @overload
     * @param {{ type: 'perspective', yfov: number, aspectRatio?: number, znear: number, zfar: number  }} projection
     * @return {mat4}
     *
     * @overload
     * @param {{ type: 'orthographic', znear: number, zfar: number, xmag: number, ymag: number  }} projection
     * @return {mat4}
     *
     * @param {{ type: 'perspective'|'orthographic', yfov?: number, aspectRatio?: number, znear?: number, zfar?: number, xmag?: number, ymag?: number  }} projection
     */
    getProjectionMatrix({ type = 'perspective', yfov = 1 , aspectRatio = 1, znear = 0, zfar = 0, xmag = 0, ymag = 0 }) {
        const matrix = mat4.create();

        if (type === 'perspective') {
            (this.gal.ndcZO ? mat4.perspectiveZO : mat4.perspectiveNO)(matrix, yfov, aspectRatio, znear, zfar);
        } else {
            (this.gal.ndcZO ? mat4.orthoZO : mat4.orthoNO)(matrix, -xmag, xmag, -ymag, ymag, znear, zfar);
        }

        return matrix;
    }

    /**
     * @param {mat4} matrix
     * @param {Frustum} frustum
     */
    setShadowMatrix(matrix, frustum) {
        mat4.identity(matrix);

        if(this.gal.ndcZO) {
            mat4.translate(matrix, matrix, [0.5, 0.5, 0.0]);
            mat4.scale(matrix, matrix, [0.5, -0.5, 1]);
        } else {
            mat4.translate(matrix, matrix, [0.5, 0.5, 0.5]);
            mat4.scale(matrix, matrix, [0.5, 0.5, 0.5]);
        }

        mat4.multiply(matrix, matrix, frustum.viewProjectionMatrix);
        return matrix;
    }

    /**
    * Returns the object that can be passed to the uniform buffer struct
    * @param {import('../../../graph.js').LightNode} node
    */
    getLightUniformStruct(node) {
        const { graph } = this.passData;
        const { worldTransform } = graph.getNodeState(node);
        const { light } = node.extensions.KHR_lights_punctual;

        const lightType = LIGHT_TYPES[light.type];
        const { color, intensity, range, spot } = light;

        const position = vec3.create();

        if(worldTransform){
            mat4.getTranslation(position, worldTransform);
        }

        const struct = /** @type {LightStruct} */({ lightType, color, intensity, range, position });

        if(spot) {
            struct.innerConeCos = Math.cos(spot.innerConeAngle);
            struct.outerConeCos = Math.cos(spot.outerConeAngle);
        }

        if(light.type === 'directional' || light.type === 'spot') {
            struct.direction = vec3.fromValues(0.0, 0.0, -1.0);
            if(worldTransform){
                const rotation = quat.create();
                mat4.getRotation(rotation, worldTransform);
                quat.normalize(rotation, rotation);
                vec3.transformQuat(struct.direction, struct.direction, rotation);
            }
        }
        return struct;
    }

    /**
     * Calculates the split distances for the view frustum
     * @param {number} n - The near plane
     * @param {number} f - The far plane
     * @param {number} l - The lambda coefficient that determines the interpolation between the logarithmic and a uniform partition scale
     * @param {number} m - The number of splits
     * @see https://developer.nvidia.com/gpugems/gpugems3/part-ii-light-and-shadows/chapter-10-parallel-split-shadow-maps-programmable-gpus
     */
    static calculateCascadeDepths(n, f, l, m) {
        const c = [];
        for(let i = 1; i < m; i++) {
            const log = n * Math.pow(f / n, i / m);
            const uni = n + (f - n) * (i / m);
            c[i - 1] = (l * uni) + ((1 - l) * log);
        }
        return c;
    }

    /**
     * Calculates the bounding sphere for a given view frustum and split distances
     *
     * @param {Frustum} frustum - The frustum
     * @param {number} start - The previous split distance
     * @param {number} end - The split distance
     */
    static calculateBoundingSphere(frustum, start, end) {
        const corners = [...new Array(8)].map(() => vec4.create());

        for(let i = 0; i < 8; i++) {
            vec4.transformMat4(corners[i], FRUSTUM_CUBE[i], frustum.invViewProjectionMatrix);
            vec4.scale(corners[i], corners[i], 1 / corners[i][3]);
        }

        for(let i = 0; i < 4; i++) {
            const ray  = vec3.create();
            const near = vec3.create();
            const far  = vec3.create();

            vec3.sub(ray,  corners[i + 4], corners[i]);
            vec3.normalize(ray, ray);
            vec3.scale(near, ray, start);
            vec3.scale(far,  ray, end);

            vec3.add(corners[i + 4], corners[i], far);
            vec3.add(corners[i], corners[i], near);
        }

        const center = vec3.create();
        for(let i = 0; i < 8; i++) {
            vec3.add(center, center, corners[i]);
        }
        vec3.scale(center, center, 1/8);

        let radius = 0;
        for(let i = 0; i < 8; i++) {
            radius = Math.max(radius, vec3.distance(corners[i], center));
        }
        radius = Math.ceil(radius * 16) / 16; // Step by 0.125

        return { center, radius };
    }
}
