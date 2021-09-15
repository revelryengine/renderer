import { vec3, vec4, mat4 } from './gl-matrix.js';

export class Frustum {
    constructor({ alphaSort = true, autoCull = true } = {}) {
        this.near = 0;
        this.far  = 0;
        this.viewport = { x: 0, y: 0, width: 0, height: 0 };

        this.position                = vec3.create();

        this.viewMatrix              = mat4.create();
        this.projectionMatrix        = mat4.create();
        this.viewProjectionMatrix    = mat4.create();
        this.invProjectionMatrix     = mat4.create();
        this.invViewProjectionMatrix = mat4.create();

        this.alphaSort = alphaSort;
        this.autoCull  = autoCull;

        this.primitives = {
            opaque:       [],
            transmissive: [],
            alpha:        [],
        };
    }

    clear() {
        this.viewport.x = 0;
        this.viewport.y = 0;
        this.viewport.width  = 0;
        this.viewport.height = 0;
        this.near = 0;
        this.far  = 0;

        mat4.identity(this.projectionMatrix);
        mat4.identity(this.viewProjectionMatrix);
        mat4.identity(this.invProjectionMatrix);
        mat4.identity(this.invViewProjectionMatrix);
        vec3.zero(this.position);

        this.primitives.opaque.length = 0;
        this.primitives.transmissive.length = 0;
        this.primitives.alpha.length = 0;
    }

    update({ graph, cameraNode, viewport }) {
        this.clear();

        const { x = 0, y = 0, width, height } = viewport;

        this.viewport.x = x;
        this.viewport.y = y;
        this.viewport.width  = width;
        this.viewport.height = height;

        const { 
            position, viewMatrix, projectionMatrix, viewProjectionMatrix, 
            invProjectionMatrix, invViewProjectionMatrix
        } = this;

        graph.updateNode(cameraNode);
        const cameraTransform = graph.getWorldTransform(cameraNode);

        cameraNode.camera.getProjectionMatrix(projectionMatrix, width, height);

        mat4.getTranslation(position, cameraTransform);
        mat4.invert(viewMatrix, cameraTransform);

        mat4.multiply(viewProjectionMatrix, projectionMatrix, viewMatrix);
        mat4.invert(invProjectionMatrix, projectionMatrix);
        mat4.invert(invViewProjectionMatrix, viewProjectionMatrix);

        this.near = projectionMatrix[14] / (projectionMatrix[10] - 1.0);
        this.far  = projectionMatrix[14] / (projectionMatrix[10] + 1.0);

        this.planes = Frustum.getFrustumPlanes(viewProjectionMatrix);

        const notCulled = (p) => !this.cull(p);
        this.primitives.opaque       = graph.primitives.opaque.filter(notCulled);
        this.primitives.transmissive = graph.primitives.transmissive.filter(notCulled);
        this.primitives.alpha        = graph.primitives.alpha.filter(notCulled);

        if(this.alphaSort) {
            this.sortAlpha(graph);
        }
    }

    static getFrustumPlanes(viewProjectionMatrix) {
        const c = {
            '11':  0, '12':  1, '13':  2, '14':  3,
            '21':  4, '22':  5, '23':  6, '24':  7,
            '31':  8, '32':  9, '33': 10, '34': 11,
            '41': 12, '42': 13, '43': 14, '44': 15,
        }
        const vp = (column) => viewProjectionMatrix[c[column]];
        return [
            //left
            [vp('14') + vp('11'), vp('24') + vp('21'), vp('34') + vp('31'), vp('44') + vp('41')],
            //right
            [vp('14') - vp('11'), vp('24') - vp('21'), vp('34') - vp('31'), vp('44') - vp('41')],
            //bottom
            [vp('14') + vp('12'), vp('24') + vp('22'), vp('34') + vp('32'), vp('44') + vp('42')],
            //top
            [vp('14') - vp('12'), vp('24') - vp('22'), vp('34') - vp('32'), vp('44') - vp('42')],
            //near
            [vp('13'), vp('23'), vp('33'), vp('43')],
            //far
            [vp('14') - vp('13'), vp('24') - vp('23'), vp('34') - vp('33'), vp('44') - vp('43')],

            // //left
            // [vp('41') + vp('11'), vp('42') + vp('12'), vp('43') + vp('13'), vp('44') + vp('14')],
            // //right
            // [vp('41') - vp('11'), vp('42') - vp('12'), vp('43') - vp('13'), vp('44') - vp('14')],
            // //bottom
            // [vp('41') + vp('21'), vp('42') + vp('22'), vp('43') + vp('23'), vp('44') + vp('24')],
            // //top
            // [vp('41') - vp('21'), vp('42') - vp('22'), vp('43') - vp('23'), vp('44') - vp('24')],
            // //near
            // [vp('41') + vp('31'), vp('42') + vp('32'), vp('43') + vp('33'), vp('44') + vp('34')],
            // //far
            // [vp('41') - vp('31'), vp('42') - vp('32'), vp('43') - vp('33'), vp('44') - vp('34')],
        ].map(p => {
            return vec4.normalize(p, p);
        });
    }

    /**
     * Returns true if primitive should be culled 
     */
    cull({ aabb }) {
        // return;
        const axis = vec3.create();
        for(const plane of this.planes) {
            axis[0] = plane[0] < 0 ? aabb.min[0] : aabb.max[0];
            axis[1] = plane[1] < 0 ? aabb.min[1] : aabb.max[1];
            axis[2] = plane[2] < 0 ? aabb.min[2] : aabb.max[2];

            if(vec3.dot(plane, axis) + plane[3] < 0) {
                return true;
            }
        }
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

    unproject(point) {
        const { viewport } = this;
        
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

    sortAlpha(graph) {
        const modelView = mat4.create();

        for(const p of this.primitives.alpha) {
            const { primitive, worldTransform } = p;

            mat4.multiply(modelView, this.viewMatrix, worldTransform);

            const centroid = graph.calculateCentroid(primitive);
            const pos = vec3.transformMat4(vec3.create(), centroid, modelView);

            p.depth = pos[2];
        }

        return this.primitives.alpha.sort((a, b) => {
            return (a.depth - b.depth);
        });
    }

    * iteratePrimitives({ opaque = true, transmissive = true, alpha = true } = {}) {
        if(opaque)       yield * this.primitives.opaque;
        if(transmissive) yield * this.primitives.transmissive;
        if(alpha)        yield * this.primitives.alpha;
    }
}

export default Frustum;