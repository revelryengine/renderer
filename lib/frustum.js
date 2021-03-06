import { vec3, vec4, mat4 } from '../deps/gl-matrix.js';
import { SHADER_STAGE } from './constants.js';

import { UBO } from './ubo.js';

/**
 * Create as a uniform buffer to ease offloading to webgpu/webgl2
 * Uses OpenGL std140 layout to support webgl2 Uniform Buffers
 */
export class Frustum extends UBO {
    static layout = new UBO.Layout([
        { name: 'near',   type: 'f32' },
        { name: 'far',    type: 'f32' },
        { name: 'width',  type: 'f32' },
        { name: 'height', type: 'f32' },

        { name: 'viewMatrix',           type: 'mat4x4<f32>' },
        { name: 'projectionMatrix',     type: 'mat4x4<f32>' },
        { name: 'viewProjectionMatrix', type: 'mat4x4<f32>' },

        { name: 'invViewMatrix',           type: 'mat4x4<f32>' },
        { name: 'invProjectionMatrix',     type: 'mat4x4<f32>' },
        { name: 'invViewProjectionMatrix', type: 'mat4x4<f32>' },

        { name: 'position',  type: 'vec3<f32>' },
    ]);

    static bindGroupLayout = {
        label: 'Frustum BindGroupLayout',
        entries: [
            {
                binding: 0,
                visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT,
                buffer: {
                    type: 'uniform',
                },
            },
        ],
    }

    constructor(gal, options) {
        super(gal);

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

        if(options) this.update(options);
    }

    update({ transform, projectionMatrix, graph, cameraNode, width, height }) {
        if(graph && cameraNode) {
            transform = transform || graph.getWorldTransform(cameraNode);
            projectionMatrix = projectionMatrix || cameraNode.camera.getProjectionMatrix({ width, height, ndcZO: this.gal.ndcZO });
        }

        if(transform) {
            mat4.identity(this.viewMatrix);
            mat4.identity(this.invViewMatrix);

            mat4.copy(this.invViewMatrix, transform);
            mat4.invert(this.viewMatrix, transform);

            mat4.getTranslation(this.position, transform);
        } 

        if(projectionMatrix) {
            this.near = projectionMatrix[14] / (projectionMatrix[10] - 1.0);
            this.far  = projectionMatrix[14] / (projectionMatrix[10] + 1.0);

            mat4.identity(this.projectionMatrix);            
            mat4.identity(this.invProjectionMatrix);
            
            mat4.copy(this.projectionMatrix, projectionMatrix);
            mat4.invert(this.invProjectionMatrix, projectionMatrix);
        }

        this.width  = width;
        this.height = height;
    
        const aspectRatio = cameraNode?.camera.getAspectRatio() || width / height;
        if(width / height !== aspectRatio) {
            //uniformly scale
            this.viewport = [...Frustum.uniformScale(width, height, aspectRatio), 0, 1];
        } else {
            this.viewport = [0, 0, width, height, 0, 1];
        }

        mat4.identity(this.viewProjectionMatrix);
        mat4.identity(this.invViewProjectionMatrix);
        mat4.multiply(this.viewProjectionMatrix, projectionMatrix, this.viewMatrix);
        mat4.invert(this.invViewProjectionMatrix, this.viewProjectionMatrix);

        this.planes = Frustum.getFrustumPlanes(this.viewProjectionMatrix);
    }

    static uniformScale(width, height, aspectRatio) {
        const w = aspectRatio * height;
        const h = width / aspectRatio;
        const s = Math.min(width / w, height / h);
        if(width / w > height / h) {
            return [(width - w) / 2, 0, w, w / aspectRatio];
        } else {
            return [0, (height - h) / 2, h * aspectRatio, h];
        }
        
    }
    
    static getFrustumPlanes(viewProjectionMatrix) {
        const indices = {
            '11':  0, '12':  1, '13':  2, '14':  3,
            '21':  4, '22':  5, '23':  6, '24':  7,
            '31':  8, '32':  9, '33': 10, '34': 11,
            '41': 12, '42': 13, '43': 14, '44': 15,
        }
        const vp = (m) => viewProjectionMatrix[indices[m]];
        return [
            [vp('14') + vp('11'), vp('24') + vp('21'), vp('34') + vp('31'), vp('44') + vp('41'), 'left'  ],
            [vp('14') - vp('11'), vp('24') - vp('21'), vp('34') - vp('31'), vp('44') - vp('41'), 'right' ],
            [vp('14') + vp('12'), vp('24') + vp('22'), vp('34') + vp('32'), vp('44') + vp('42'), 'bottom'],
            [vp('14') - vp('12'), vp('24') - vp('22'), vp('34') - vp('32'), vp('44') - vp('42'), 'top'   ],
            [vp('14') + vp('13'), vp('24') + vp('23'), vp('34') + vp('33'), vp('44') + vp('43'), 'near'  ],
            [vp('14') - vp('13'), vp('24') - vp('23'), vp('34') - vp('33'), vp('44') - vp('43'), 'far'   ],
        ].map(p => {
            return vec4.normalize(p, p);
        });
    }

    /** 
     * Projects a point
     * @param {vec3} point - The point to project
     * @return {vec3}
     */
    project(point) {
        const projected = vec4.transformMat4(vec4.create(), vec4.fromValues(...point, 1), this.projectionMatrix);
        return vec3.scale(point, projected, 1 / projected[3]);
    }

    unproject(point, viewport) {    
        const ncd = vec4.fromValues(...point, 1);
    
        ncd[0] = ncd[0] / viewport.width;
        ncd[1] = ncd[1] / viewport.height;
    
        ncd[0] = ncd[0] * 2 - 1;
        ncd[1] = 1 - ncd[1] * 2; //y is flipped for opengl
        ncd[2] = ncd[2] * 2 - 1;
    
        const eye = vec4.transformMat4(vec4.create(), ncd, this.invViewProjectionMatrix);
        return vec3.scale(vec3.create(), eye, 1 / eye[3]);
    }

    getLinearDepth(z) {
        return this.near * this.far / (this.far + z * (this.near - this.far));
    }

    getNonLinearDepth(z) {
        return (((this.near * this.far) / z) - this.far) / (this.near - this.far);
    }

    /**
     * Returns true if aabb is inside frustum 
     */
    containsAABB(aabb) {
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
}

export default Frustum;