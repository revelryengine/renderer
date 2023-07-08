import { LIGHT_TYPES } from '../../../constants.js';
import { Frustum     } from '../../../frustum.js';
import { Punctual    } from '../../../punctual.js';

import { GLTFNode         } from '../../common/nodes/gltf-node.js';
import { GLTFShadowShader } from '../../common/shaders/gltf-shader.js';

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

/**
 * The Punctual Node is responsible for uploading all the punctual lighting information
 */
export class PunctualNode extends GLTFNode {
    Shader = GLTFShadowShader;

    size = { width: 2048, height: 2048 };

    attachments = {
        colors: { },
        depth:  { },
    }

    layers = 6;

    opaque = true;

    reconfigure(...args){
        this.punctual        = new Punctual(this.gal);
        this.output.punctual = this.punctual;

        this.bindGroupLayout = this.gal.device.createBindGroupLayout({
            label: this.constructor.name,
            entries: [],
        });

        this.bindGroup = this.gal.device.createBindGroup({
            label: this.constructor.name,
            layout: this.bindGroupLayout,
            entries: []
        });

        this.output.shadowsSampler = this.gal.device.createSampler({ minFilter: 'linear', magFilter: 'linear', compare: 'less' });

        super.reconfigure(...args);
    }

    run(commandEncoder, { graph, frustum }) {
        this.punctual.lightCount = Math.min(graph.lights.length, this.punctual.lights.length);

        for(let i = 0, l = this.punctual.lightCount; i < l; i++) {
            Object.assign(this.punctual.lights[i], this.getLightUniformStruct(graph, graph.lights[i]));     
        }

        this.punctual.exposure = 1;

        if(!this.settings.shadows.enabled) return this.punctual.upload();

        const settings = this.settings.shadows;

        const { near, far } = frustum;

        this.punctual.shadowCascadeDepths = PunctualNode.calculateCascadeDepths(near, far, settings.lambda, settings.cascades);
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
                        const instances = graph.generateInstances(shadowFrustum);
                        super.run(commandEncoder, { graph, frustum: shadowFrustum, instances, layer: layer + i });

                        this.setShadowMatrix(this.punctual.shadowMatrices[layer + i], shadowFrustum);
                    }
                    layer += settings.cascades;
                    break;
                }
                case LIGHT_TYPES.spot: {
                    light.shadowLayer = layer;
                    const shadowFrustum = this.getShadowFrustum(light, frustum);
                    const instances = graph.generateInstances(shadowFrustum);
                    super.run(commandEncoder, { graph, frustum: shadowFrustum, instances, layer });
                    
                    this.setShadowMatrix(this.punctual.shadowMatrices[layer], shadowFrustum);
                    layer++;
                    break;
                }
            }
        }
        
        this.punctual.shadowCount = layer;
        this.punctual.upload();
    }

    #spotShadowFrustums        = new WeakMap();
    #directionalShadowFrustums = new WeakMap();
    getShadowFrustum(light, frustum, near, far) {
        let shadowFrustum, transform, projectionMatrix;

        if(light.lightType === LIGHT_TYPES.spot) {
            shadowFrustum = this.#spotShadowFrustums.get(light) ?? this.#spotShadowFrustums.set(light, new Frustum(this.gal, { x: 0, y: 0, width: this.size.width, height: this.size.height })).get(light);

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

            shadowFrustum = shadowFrustums[near] ?? (shadowFrustums[near] = new Frustum(this.gal, { x: 0, y: 0, width: this.size.width, height: this.size.height }));

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

    getProjectionMatrix({ type = 'perspective', yfov, aspectRatio = 1, znear, zfar, xmag, ymag }) {
        const matrix = mat4.create();
        
        if (type === 'perspective') {
            (this.gal.ndcZO ? mat4.perspectiveZO : mat4.perspectiveNO)(matrix, yfov, aspectRatio, znear, zfar);
        } else {
            (this.gal.ndcZO ? mat4.orthoZO : mat4.orthoNO)(matrix, -xmag, xmag, -ymag, ymag, znear, zfar);
        }
        
        return matrix;
    }

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
    * @param {Node} node
    * @returns {Object}
    */
    getLightUniformStruct(graph, node) {
        const { worldTransform } = graph.getState(node);
        const { light } = node.extensions.KHR_lights_punctual;

        const lightType = LIGHT_TYPES[light.type];
        const { color, intensity, range, spot } = light;
        
        const position = vec3.create();
        
        if(worldTransform){
            mat4.getTranslation(position, worldTransform);
        }
        
        const struct = { lightType, color, intensity, range, position };
        
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
     * @param {Number} n - The near plane
     * @param {Number} f - The far plane
     * @param {Number} l - The lambda coefficient that determines the interpolation between the logarithmic and a uniform partition scale
     * @param {Number} m - The number of splits
     * @see: https://developer.nvidia.com/gpugems/gpugems3/part-ii-light-and-shadows/chapter-10-parallel-split-shadow-maps-programmable-gpus
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
     * @param {Object} frustum - The frustum
     * @param {Number} start - The previous split distance
     * @param {Number} end - The split distance
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

export default PunctualNode;