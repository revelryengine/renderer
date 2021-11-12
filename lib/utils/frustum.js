import { UBO } from '../renderer/ubo.js';
import { vec3, vec4, mat4 } from './gl-matrix.js';

const GL = WebGL2RenderingContext;

const INSTANCE_LAYER_SIZE   = 128 * 128; // number of matrices per layer
const INSTANCE_LAYER_WIDTH  = 256;
const INSTANCE_LAYER_HEIGHT = 256;
const INSTANCE_MAX_LAYERS   = 8;

export class Frustum extends UBO {
    static location = 0;

    static layout = new UBO.Layout([
        { name: 'u_FrustumNear',             type: GL.FLOAT      },
        { name: 'u_FrustumFar',              type: GL.FLOAT      },
        { name: 'u_ViewportWidth',           type: GL.FLOAT      },
        { name: 'u_ViewportHeight',          type: GL.FLOAT      },
        { name: 'u_FrustumPosition',         type: GL.FLOAT_VEC3 }, 
        { name: 'u_ViewMatrix',              type: GL.FLOAT_MAT4 },
        { name: 'u_ProjectionMatrix',        type: GL.FLOAT_MAT4 },
        { name: 'u_ViewProjectionMatrix',    type: GL.FLOAT_MAT4 },
        { name: 'u_InvProjectionMatrix',     type: GL.FLOAT_MAT4 },
        { name: 'u_InvViewProjectionMatrix', type: GL.FLOAT_MAT4 },
        { name: 'u_InvViewMatrix',           type: GL.FLOAT_MAT4 },
    ]);
    

    #instanceDataLayers = [new Float32Array(INSTANCE_LAYER_SIZE * 16)];

    constructor(context, { alphaSort = true, autoCull = true } = {}) {
        super(context);

        this.viewport = { x: 0, y: 0, width: 0, height: 0 };

        this.alphaSort = alphaSort;
        this.autoCull  = autoCull;

        this.primitives = {
            opaque:       [],
            transmissive: [],
            alpha:        [],
        };

        this.blocks = {
            opaque:       [],
            transmissive: [],
            alpha:        [],
        };

        this.instanceDataTexture = this.createInstanceDataTexture();
    }

    get viewMatrix() {
        return this.views.u_ViewMatrix;
    }

    get projectionMatrix() {
        return this.views.u_ProjectionMatrix;
    }

    get viewProjectionMatrix() {
        return this.views.u_ViewProjectionMatrix;
    }

    get invProjectionMatrix() {
        return this.views.u_InvProjectionMatrix;
    }

    get invViewProjectionMatrix() {
        return this.views.u_InvViewProjectionMatrix;
    }

    get invViewMatrix() {
        return this.views.u_InvViewMatrix;
    }

    get position() {
        return this.views.u_FrustumPosition;
    }

    get near() {
        return this.views.u_FrustumNear[0];
    }

    get far() {
        return this.views.u_FrustumFar[0];
    }

    get width() {
        return this.views.u_ViewportWidth[0];
    }

    get height() {
        return this.views.u_ViewportHeight[0];
    }

    clear() {
        this.views.u_ViewportWidth[0]  = 0;
        this.views.u_ViewportHeight[0] = 0;

        this.views.u_FrustumNear[0] = 0;
        this.views.u_FrustumNear[0] = 0;

        mat4.identity(this.projectionMatrix);
        mat4.identity(this.viewProjectionMatrix);
        mat4.identity(this.invProjectionMatrix);
        mat4.identity(this.invViewProjectionMatrix);
        vec3.zero(this.position);

        this.primitives.opaque.length = 0;
        this.primitives.transmissive.length = 0;
        this.primitives.alpha.length = 0;
        this.blocks.opaque.length = 0;
        this.blocks.transmissive.length = 0;
        this.blocks.alpha.length = 0;
    }

    update({ graph, cameraNode, viewport }) {
        this.clear();

        const { width, height } = viewport;

        const { 
            position, viewMatrix, projectionMatrix, viewProjectionMatrix, 
            invProjectionMatrix, invViewProjectionMatrix, invViewMatrix,
        } = this;

        graph.updateNode(cameraNode);
        const cameraTransform = graph.getWorldTransform(cameraNode);

        cameraNode.camera.getProjectionMatrix(projectionMatrix, width, height);

        mat4.getTranslation(position, cameraTransform);
        mat4.invert(viewMatrix, cameraTransform);

        mat4.multiply(viewProjectionMatrix, projectionMatrix, viewMatrix);
        mat4.invert(invProjectionMatrix, projectionMatrix);
        mat4.invert(invViewProjectionMatrix, viewProjectionMatrix);

        mat4.copy(invViewMatrix, cameraTransform);

        this.views.u_FrustumNear[0]    = projectionMatrix[14] / (projectionMatrix[10] - 1.0);
        this.views.u_FrustumFar[0]     = projectionMatrix[14] / (projectionMatrix[10] + 1.0);
        this.views.u_ViewportWidth[0]  = width;
        this.views.u_ViewportHeight[0] = height;

        this.planes = Frustum.getFrustumPlanes(viewProjectionMatrix);

        const notCulled = (p) => !this.cull(p);
        this.primitives.opaque       = graph.primitives.opaque.filter(notCulled);
        this.primitives.transmissive = graph.primitives.transmissive.filter(notCulled);
        this.primitives.alpha        = graph.primitives.alpha.filter(notCulled);

        if(this.alphaSort) {
            this.sortAlpha(graph);
        }

        this.generateBlocks(graph);
        this.upload();
    }

    upload(){
        super.upload();
        this.uploadInstanceData();
    }

    generateBlocks(graph) {
        const indices = { models: {}, skins: {} };

        let currentLayer = 0, offset = 0;

        const addMatricesToLayers = (matrices) => {
            let layer  = this.#instanceDataLayers[currentLayer];
            if(offset + matrices.length > ((currentLayer + 1) * INSTANCE_LAYER_SIZE)) {
                layer = this.#instanceDataLayers[currentLayer++];
                if(!layer){
                    layer = this.#instanceDataLayers[currentLayer] = new Float32Array(INSTANCE_LAYER_SIZE * 16);
                }
                offset = currentLayer * INSTANCE_LAYER_SIZE;
            }
            for(let i = 0; i < matrices.length; i++) {
                layer.set(matrices[i], (offset + i) * 16);
            }
            const index = offset;
            offset += matrices.length;
            return index;
        }

        const getModel = (node, worldTransform) => {
            if(indices.models[node.$id] !== undefined) return indices.models[node.$id];
            const weights  = node.weights || node.mesh.weights;
            const matrices = weights ? [worldTransform, weights] : [worldTransform];
            return indices.models[node.$id] = addMatricesToLayers(matrices);
        }

        const getSkin = (node, graph) => {
            const { skin } = node;
            if(!skin) return 0;
            if(indices.skins[skin.$id] !== undefined) return indices.skins[skin.$id];
            const { jointMatrices, jointNormalMatrices } = graph.getJointMatrices(node, skin);
            return indices.skins[skin.$id] = (addMatricesToLayers([...jointMatrices, ...jointNormalMatrices]) << 8) | skin.joints.length;
        }

        let lastPrimitive = null, currentBlock = null;
        const processPrimitive = (blocks, { primitive, mesh, node, worldTransform }) => {
            if(primitive !== lastPrimitive) {
                currentBlock = { primitive, mesh, instances: [] };
                blocks.push(currentBlock);
            }
            currentBlock.instances.push(primitive.$id, node.$id, getModel(node, worldTransform), getSkin(node, graph));
            lastPrimitive = primitive;
        }

        for(const p of this.primitives.opaque){
            processPrimitive(this.blocks.opaque, p);
        }

        for(const p of this.primitives.transmissive){
            processPrimitive(this.blocks.transmissive, p);
        }

        for(const p of this.primitives.alpha){
            processPrimitive(this.blocks.alpha, p);
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

    * iterateBlocks({ opaque = true, transmissive = true, alpha = true } = {}) {
        if(opaque)       yield * this.blocks.opaque;
        if(transmissive) yield * this.blocks.transmissive;
        if(alpha)        yield * this.blocks.alpha;
    }

    /**
     * Creates a texture chunk for storing instance data
     * A matrix is 4 vec4 components. A vec4 is 4 Float32 components. Which is 16 Float32 components per matrix.
     * We weant to store at least 128 skins with 128 joints each in one chunk. 
     * So that is 16 x 128 x 128 = 262144 Float32 components or 256 x 256 pixels.
     * This is an insane amount of joints though. That's also 1024 skins with 16 joints which is much more reasonable.
     */
    createInstanceDataTexture() {
        const { context: gl } = this;

        const glTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, glTexture);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA32F, INSTANCE_LAYER_WIDTH, INSTANCE_LAYER_HEIGHT, INSTANCE_MAX_LAYERS, 0, gl.RGBA, gl.FLOAT, null);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);

        return glTexture;
    }

    uploadInstanceData() {
        const { context: gl, instanceDataTexture } = this;
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, instanceDataTexture);
        for(let i = 0; i < this.#instanceDataLayers.length; i++) {
            const layer = this.#instanceDataLayers[i];
            gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, INSTANCE_LAYER_WIDTH, INSTANCE_LAYER_HEIGHT, 1, gl.RGBA, gl.FLOAT, layer);
        }
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
}

export default Frustum;