import { vec3, vec4, mat4, quat } from '../deps/gl-matrix.js';
import { SHADER_STAGE } from './constants.js';
import { RevGAL } from './revgal.js';

import { UBO } from './ubo.js';

const HALTON = [
    [0.500000, 0.333333],
    [0.250000, 0.666667],
    [0.750000, 0.111111],
    [0.125000, 0.444444],
    [0.625000, 0.777778],
    [0.375000, 0.222222],
    [0.875000, 0.555556],
    [0.062500, 0.888889],
    [0.562500, 0.037037],
    [0.312500, 0.370370],
    [0.812500, 0.703704],
    [0.187500, 0.148148],
    [0.687500, 0.481481],
    [0.437500, 0.814815],
    [0.937500, 0.259259],
    [0.031250, 0.592593],
];

/**
 * Create as a uniform buffer to ease offloading to webgpu/webgl2
 * Uses OpenGL std140 layout to support webgl2 Uniform Buffers
 */
export class Frustum extends UBO.Layout({
    near:   { type: 'f32' },
    far:    { type: 'f32' },
    width:  { type: 'f32' },
    height: { type: 'f32' },

    viewMatrix:           { type: 'mat4x4<f32>' },
    projectionMatrix:     { type: 'mat4x4<f32>' },
    viewProjectionMatrix: { type: 'mat4x4<f32>' },

    invViewMatrix:           { type: 'mat4x4<f32>' },
    invProjectionMatrix:     { type: 'mat4x4<f32>' },
    invViewProjectionMatrix: { type: 'mat4x4<f32>' },

    position: { type: 'vec3<f32>' },
    jitter:   { type: 'vec2<f32>' },

    prevViewProjectionMatrix: { type: 'mat4x4<f32>' },
}){
    static bindGroupLayout = {
        label: 'Frustum BindGroupLayout',
        entries: [
            {
                binding: 0,
                visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT,
                buffer: /** @type {const} */({ type: 'uniform' }),
            },
        ],
    }

    #jitterFrame = 0;

    /**
     * @param {RevGAL} gal
     * @param {{ width: number, height: number }} size
     */
    constructor(gal, size) {
        super(gal);

        this.size      = size;
        this.bindGroup = gal.device.createBindGroup({
            label: 'Frustum BindGroup',
            layout: gal.device.createBindGroupLayout(Frustum.bindGroupLayout),
            entries: [{
                binding: 0,
                resource: {
                    buffer: this.buffer
                }
            }]
        });

        this.uniformViewport = [0, 0, 0, 0, 0, 0];

        this.grid = {
            orientation: quat.create(),
            zfar:  undefined,
            znear: undefined,
        }

        this.planes = Frustum.getFrustumPlanes(this.viewProjectionMatrix);
    }

    /**
     * @overload
     * @param {{ graph: import('./graph.js').Graph, cameraNode: import('./renderer.js').ViewportCameraNode, jitter?: boolean }} options
     * @return {void}
     *
     * @overload
     * @param {{ transform: mat4, projectionMatrix: mat4, jitter?: boolean }} options
     * @return {void}
     *
     * @param {{ graph?: import('./graph.js').Graph, cameraNode?: import('./renderer.js').ViewportCameraNode, transform?: mat4, projectionMatrix?: mat4, jitter?: boolean }} options
     */
    update({ graph, cameraNode, transform, projectionMatrix, jitter }) {
        const { width, height } = this.size;

        if(graph && cameraNode) {
            transform = graph.getWorldTransform(cameraNode);
            projectionMatrix = cameraNode.camera.getProjectionMatrix({ width, height, ndcZO: this.gal.ndcZO });
        } else if(!transform || !projectionMatrix) throw new Error ('Invalid options')

        mat4.copy(this.prevViewProjectionMatrix, this.viewProjectionMatrix);

        mat4.identity(this.viewMatrix);
        mat4.identity(this.invViewMatrix);

        mat4.copy(this.invViewMatrix, transform);
        mat4.invert(this.viewMatrix, transform);

        mat4.getTranslation(this.position, transform);

        mat4.identity(this.projectionMatrix);
        mat4.identity(this.invProjectionMatrix);

        mat4.copy(this.projectionMatrix, projectionMatrix);
        mat4.invert(this.invProjectionMatrix, projectionMatrix);

        mat4.identity(this.viewProjectionMatrix);
        mat4.identity(this.invViewProjectionMatrix);
        mat4.multiply(this.viewProjectionMatrix, projectionMatrix, this.viewMatrix);
        mat4.invert(this.invViewProjectionMatrix, this.viewProjectionMatrix);

        this.planes = Frustum.getFrustumPlanes(this.viewProjectionMatrix);

        this.aspectRatio = cameraNode?.camera.getAspectRatio() ?? width / height;
        if(width / height !== this.aspectRatio) {
            //uniformly scale
            this.uniformViewport = [...Frustum.uniformScale(width, height, this.aspectRatio), 0, 1];
        } else {
            this.uniformViewport = [0, 0, width, height, 0, 1];
        }

        this.width  = width;
        this.height = height;

        if(cameraNode) {
            const details = cameraNode.camera.getDetails();

            this.near = details.znear;
            this.far  = details.zfar ?? Infinity;
        }

        if(jitter) {
            const halton = HALTON[this.#jitterFrame++ % 16];
            this.jitter.set([halton[0] / width, halton[1] / height]);
        } else {
            this.#jitterFrame = 0;
            this.jitter.set([0, 0]);
        }

        this.upload();
    }


    /**
     * @param {number} width
     * @param {number} height
     * @param {number} aspectRatio
     */
    static uniformScale(width, height, aspectRatio) {
        const w = aspectRatio * height;
        const h = width / aspectRatio;
        if(width / w > height / h) {
            return [(width - w) / 2, 0, w, w / aspectRatio];
        } else {
            return [0, (height - h) / 2, h * aspectRatio, h];
        }

    }

    /**
     * @param {mat4} viewProjectionMatrix
     */
    static getFrustumPlanes(viewProjectionMatrix) {
        const indices = /** @type {Record<String, number>} */({
            '11':  0, '12':  1, '13':  2, '14':  3,
            '21':  4, '22':  5, '23':  6, '24':  7,
            '31':  8, '32':  9, '33': 10, '34': 11,
            '41': 12, '42': 13, '43': 14, '44': 15,
        })
        const vp = /** @param {string} m */(m) => viewProjectionMatrix[indices[m]];
        return /** @type {[number, number, number, number, string][]} */([
            [vp('14') + vp('11'), vp('24') + vp('21'), vp('34') + vp('31'), vp('44') + vp('41'), 'left'  ],
            [vp('14') - vp('11'), vp('24') - vp('21'), vp('34') - vp('31'), vp('44') - vp('41'), 'right' ],
            [vp('14') + vp('12'), vp('24') + vp('22'), vp('34') + vp('32'), vp('44') + vp('42'), 'bottom'],
            [vp('14') - vp('12'), vp('24') - vp('22'), vp('34') - vp('32'), vp('44') - vp('42'), 'top'   ],
            [vp('14') + vp('13'), vp('24') + vp('23'), vp('34') + vp('33'), vp('44') + vp('43'), 'near'  ],
            [vp('14') - vp('13'), vp('24') - vp('23'), vp('34') - vp('33'), vp('44') - vp('43'), 'far'   ],
        ]).map(p => {
            return vec4.normalize(/** @type {vec4} */(p), /** @type {vec4} */(p));
        });
    }

    /**
     * @param {mat4} world
     * @param {vec3} [out]
     */
    project(world, out = vec3.create()) {
        return vec3.transformMat4(out, world, this.viewProjectionMatrix);
    }

    /**
     * @param {mat4} ndc
     * @param {vec3} [out]
     */
    unproject(ndc, out = vec3.create()) {
        return vec3.transformMat4(out, ndc, this.invViewProjectionMatrix);
    }

    #viewPoint = vec3.create();
    /**
     * @param {number} pixelX
     * @param {number} pixelY
     * @param {vec3} [out]
     */
    unprojectViewPoint(pixelX, pixelY, out = vec3.create()) {
        const ndcX = ((pixelX / this.width) * 2) - 1;
        const ndcY = 1 - ((pixelY / this.height) * 2);

        vec3.set(this.#viewPoint, ndcX, ndcY, 1);
        return this.unproject(this.#viewPoint, out);
    }

    /**
     * @param {number} z
     */
    getLinearDepth(z) {
        return this.near * this.far / (this.far + z * (this.near - this.far));
    }

    /**
     * @param {number} z
     */
    getNonLinearDepth(z) {
        return (((this.near * this.far) / z) - this.far) / (this.near - this.far);
    }

    /**
     * @param {vec3} out
     */
    getGridPlane(out = vec4.create()) {
        vec3.transformQuat(out, vec3.fromValues(0, 1, 0), this.grid.orientation);
        out[3] = 0;
        return out;
    }

    /**
     * Returns true if aabb is inside frustum
     *
     * @param {{ min: vec3, max: vec3 }} aabb
     */
    containsAABB(aabb) {
        if(!this.planes) throw new Error('Invalid state');

        const axis = vec3.create();
        for(const plane of this.planes) {
            axis[0] = plane[0] < 0 ? aabb.min[0] : aabb.max[0];
            axis[1] = plane[1] < 0 ? aabb.min[1] : aabb.max[1];
            axis[2] = plane[2] < 0 ? aabb.min[2] : aabb.max[2];

            if(vec3.dot(plane, axis) + plane[3] < 0) {
                return false;
            }
        }
        return true;
    }

    /**
     * @todo: Implement this properly to support XR
     *
     * @param {Frustum} frustum
     */
    union(frustum) {
        return this;
    }
}
