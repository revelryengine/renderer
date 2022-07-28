import { vec3, mat3, mat4, quat } from '../deps/gl-matrix.js';
import { BUFFER_USAGE, SHADER_STAGE } from './constants.js';

import { Material  } from './material.js';
import { MatrixTBO } from './tbo.js';
import { roundUp   } from './utils.js';

class ModelMatrixTBO extends MatrixTBO {
    static layout = new MatrixTBO.Layout({ width: 64, height: 64, limit: 4 });
}

class JointMatrixTBO extends MatrixTBO {
    static layout = new MatrixTBO.Layout({ width: 64, height: 64, limit: 4 });
}

class MorphMatrixTBO extends MatrixTBO {
    static layout = new MatrixTBO.Layout({ width: 64, height: 64, limit: 4 });
}

/**
 * Analyzes a scene and calculates new transforms for all nodes. It does this in a non destructive way by
 * keeping results in an internal state.
 */
export class Graph {
    state      = new WeakMap();
    #centroids = new WeakMap();

    static bindGroupLayout = {
        label: 'Graph BindGroupLayout',
        entries: [
            //settings
            { binding: 0, visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT, buffer: {} },
            //modelMatrix
            { binding: 1, visibility: SHADER_STAGE.VERTEX, texture: { viewDimension: '2d-array', sampleType: 'unfilterable-float' } },
            //jointMatrix
            { binding: 2, visibility: SHADER_STAGE.VERTEX, texture: { viewDimension: '2d-array', sampleType: 'unfilterable-float' } },
            //morphMatrix
            { binding: 3, visibility: SHADER_STAGE.VERTEX, texture: { viewDimension: '2d-array', sampleType: 'unfilterable-float' } },
        ],
    };

    updateBindGroup() {
        this.bindGroup = this.gal.device.createBindGroup({
            label: 'Graph BindGroup',
            layout: this.gal.device.createBindGroupLayout(Graph.bindGroupLayout),
            entries: [
                //settings
                { binding: 0, resource: { buffer: this.gal.settings.buffer } },
                //modelMatrix
                { binding: 1, resource: this.modelBuffer.texture.createView({ dimension: '2d-array' }) },
                //jointMatrix
                { binding: 2, resource: this.jointBuffer.texture.createView({ dimension: '2d-array' }) },
                //morphMatrix
                { binding: 3, resource: this.morphBuffer.texture.createView({ dimension: '2d-array' }) },
            ],
        });
    }

    constructor(gal, scene) {
        this.gal = gal;

        this.modelBuffer = new ModelMatrixTBO(gal); 
        this.jointBuffer = new JointMatrixTBO(gal); 
        this.morphBuffer = new MorphMatrixTBO(gal); 

        this.scene = scene;

        /**
         * Arrays of { primitive, node, opaque, depth, index, aabb }
         */
        this.instances = {
            opaque: [],
            transmissive: [],
            alpha: [],
        };


        /**
         * Array of nodes that have skins
         */
        this.skins = [];

        /**
         * Array of nodes that have morphs
         */
        this.morphs = [];

        /**
         * Array of nodes that have a light
         */
        this.lights = [];

        /**
         * Array of materials used in scene
         */
        this.materials = [];

        this.updateScene();
        this.updateBindGroup();
    }

    get environment() {
        return this.scene.extensions?.KHR_lights_environment?.light;
    }

    clear() {
        this.instances.opaque.length = 0;
        this.instances.transmissive.length = 0;
        this.instances.alpha.length = 0;

        this.lights.length    = 0;
        this.skins.length     = 0;
        this.morphs.length    = 0;
        this.materials.length = 0;
    }

    updateScene() {
        for (const node of this.scene.nodes) {
            this.updateNode(node);
        }
    }

    /**
     * Caclulates the centroid of a primitive. Useful for alpha sort ordering based on centroid depth from camera.
     * https://github.com/KhronosGroup/glTF-Sample-Viewer/blob/d32ca25dc273c0b0982e29efcea01b45d0c85105/src/gltf_utils.js#L88
     * @param {Primitive} primitive
     */
    calculateCentroid(primitive) {
        let centroid = this.#centroids.get(primitive);
        if (centroid) return centroid;

        const accessor = primitive.attributes.POSITION;
        const positions = accessor.getTypedArray();

        const acc = new Float32Array(3);
        const stride = (accessor.bufferView?.byteStride || 12) / 4;

        if (primitive.indices) {
            const indices = primitive.indices.getTypedArray();

            for (let i = 0; i < indices.length; i++) {
                const index = stride * indices[i];
                acc[0] += positions[index];
                acc[1] += positions[index + 1];
                acc[2] += positions[index + 2];
            }

            centroid = new Float32Array([
                acc[0] / indices.length,
                acc[1] / indices.length,
                acc[2] / indices.length,
            ]);

            this.#centroids.set(primitive, centroid);
        } else {
            for (let i = 0; i < positions.length; i += 3) {
                const index = stride * i;
                acc[0] += positions[index];
                acc[1] += positions[index + 1];
                acc[2] += positions[index + 2];
            }

            const positionVectors = positions.length / 3;

            centroid = new Float32Array([
                acc[0] / positionVectors,
                acc[1] / positionVectors,
                acc[2] / positionVectors,
            ]);

            this.#centroids.set(primitive, centroid);
        }
        return centroid;
    }

    /**
     * Returns the current state for the node or initializes it if is not present.
     * @param {Node} node - The node to get the state for
     * @returns {Object} - An object containg the state
     */
    getState(node) {
        let state = this.state.get(node); //weakmap is kind of slow, come back to this
        if (!state) {

            state = {
                localTransform: mat4.create(),
                parent: null,
            };

            if (!node.mesh) {
                state.worldTransform = mat4.create();
                
            } else {
                const { index, block } = this.modelBuffer.createMatrixViewBlock(2);
                state.worldTransform = block[0].matrixView;
                state.modelMatrix    = state.worldTransform;
                state.normalMatrix   = block[1].matrixView;
                state.index = index;

                state.worldTransformInverse = mat4.create();

                if(node.skin) {
                    state.skin = this.getSkinState(node.skin);
                }

                const weights = node.weights || node.mesh.weights;
                if(weights) {
                    state.morph = this.getMorphState(weights);
                }
            }

            this.state.set(node, state);
        }
        return state;
    }

    getSkinState(skin) {
        let state =  this.state.get(skin);
        if(!state) {
            const { index, block } = this.jointBuffer.createMatrixViewBlock(skin.joints.length * 2);

            state = {
                index,
                jointMatrices: block,
            };

            this.state.set(skin, state);
        } 
        return state;
    }

    getMorphState(weights) {
        let state =  this.state.get(weights);
        if(!state) {
            const { index, block } = this.morphBuffer.createMatrixViewBlock(Math.ceil(weights.length / 16))

            state = {
                index,
                weights: block,
            };

            this.state.set(weights, state);
        } 
        return state;
    }

    /**
     * Returns the local transform matrix.
     * @returns {mat4}
     */
    getLocalTransform(node) {
        return this.getState(node).localTransform;
    }

    /**
     * Returns the world transform matrix based on last update.
     * @returns {mat4}
     */
    getWorldTransform(node) {
        return this.getState(node).worldTransform;
    }

    /**
     * Returns the parent of the node
     */
    getParent(node) {
        return this.getState(node).parent;
    }

    /**
     * Updates the node's transform information relative to the parentTransform.
     * @param {Node} node - The node to update
     */
    updateNode(node) {
        const { matrix, mesh, skin } = node;

        const {
            localTransform,
            worldTransform,
            worldTransformInverse,
            normalMatrix,
            parent,
            index,
        } = this.getState(node);

        const parentTransform = parent ? this.getWorldTransform(parent) : mat4.create();

        if (matrix) {
            mat4.copy(localTransform, matrix);
        } else {
            const { translation = [0.0, 0.0, 0.0], rotation = [0.0, 0.0, 0.0, 1.0], scale = [1.0, 1.0, 1.0] } = node;
            const q = quat.create();
            quat.normalize(q, rotation);
            mat4.fromRotationTranslationScale(localTransform, rotation, translation, scale);
        }

        // Update world transform
        mat4.copy(worldTransform, localTransform);
        mat4.mul(worldTransform, parentTransform, localTransform);

        

        if (node.extensions?.KHR_lights_punctual) {
            if (this.lights.indexOf(node) === -1) {
                this.lights.push(node);
            }
        }

        if (mesh) {
            // Update world transform inverse
            mat4.invert(worldTransformInverse, worldTransform);

            // Update normal matrix
            mat4.transpose(normalMatrix, worldTransformInverse);

            //Clear any primitives from a previous update
            this.instances.opaque       = this.instances.opaque.filter(p => node != p.node);
            this.instances.transmissive = this.instances.transmissive.filter(p => node != p.node);
            this.instances.alpha        = this.instances.alpha.filter(p => node != p.node);

            for (const primitive of mesh.primitives) {
                const aabb = this.getPrimitiveAABB(primitive, worldTransform);
                const instance = { index, node, primitive, worldTransform, aabb };

                if (!primitive.material) {
                    this.instances.opaque.push(instance);
                    continue;
                }

                if (primitive.material.alphaMode === 'BLEND' || primitive.material.alphaMode === 'MASK') {
                    this.instances.alpha.push(instance);
                } else if (primitive.material.extensions.KHR_materials_transmission) {
                    this.instances.transmissive.push(instance);
                } else {
                    this.instances.opaque.push(instance);
                }

                if(this.materials.indexOf(primitive.material) === -1) {
                    this.materials.push(primitive.material);
                }
            }

            if (skin) {
                /**
                 * @todo optimize this, it's pretty inefficient. Maybe change this to a set.
                 */
                if (this.skins.indexOf(node) === -1) {
                    this.skins.push(node);
                }
            }
    
            if (node.weights || mesh.weights) {
                if (this.morphs.indexOf(node) === -1) {
                    this.morphs.push(node);
                }
            }
        }

        for (const child of node.children) {
            this.getState(child).parent = node;
            this.updateNode(child);
        }
    }

    /**
     * Updates a set of nodes while avoiding redundant updates by using BFS
     * Assumes scene is a true Tree and nodes only exist once, as per the glTF spec.
     */
    updateNodes(nodes, root = this.scene) {
        const search = [...(root.nodes || root.children)];

        while (search.length) {
            const node = search.shift();
            if (nodes.has(node)) {
                this.updateNode(node);
            } else {
                search.push(...node.children);
            }
        }
    }

    updateSkins() {
        for (const node of this.skins) {
            const { skin, worldTransformInverse } = this.getState(node);

            const { jointMatrices } = skin;

            for (let i = 0; i < node.skin.joints.length; i++) {
                const jointMatrix       = jointMatrices[i * 2].matrixView;
                const jointNormalMatrix = jointMatrices[i * 2 + 1].matrixView;
                
                const jointTransform = this.getWorldTransform(node.skin.joints[i]);
                const inverseBindMatrix = node.skin.inverseBindMatrices.createTypedView(i * 16, 1);

                mat4.mul(jointMatrix, jointTransform, inverseBindMatrix);
                mat4.mul(jointMatrix, worldTransformInverse, jointMatrix);

                mat4.invert(jointNormalMatrix, jointMatrix);
                mat4.transpose(jointNormalMatrix, jointNormalMatrix);
            }
        }
    }

    updateMorphs() {
        for(const node of this.morphs) {
            const state = this.getState(node).morph;
            const { weights } = state;
            const src = node.weights || node.mesh.weights;
            for(let i = 0; i < weights.length; i++) {
                weights[i].matrixView.set(src.slice(i * 16, i * 16 + 16));
            }
        }
    }

    getPrimitiveAABB(primitive, nodeTransform) {
        const { POSITION } = primitive.attributes;

        const center = vec3.create();
        vec3.add(center, POSITION.max, POSITION.min);
        vec3.scale(center, center, 0.5);

        const extents = vec3.create();
        vec3.sub(extents, POSITION.max, center);

        vec3.transformMat4(center, center, nodeTransform);

        const abs = mat3.create();
        mat3.fromMat4(abs, nodeTransform);

        for (let i = 0; i < abs.length; i++) {
            abs[i] = Math.abs(abs[i]);
        }

        vec3.transformMat3(extents, extents, abs);

        const min = vec3.sub([], center, extents);
        const max = vec3.add([], center, extents);

        /**
         * split the transform into a translation vector (T) and a 3x3 rotation (M).
         *  B = zero-volume AABB at T
         *  for each element (i,j) of M:
         *      a = M[i][j] * A.min[j]
         *      b = M[i][j] * A.max[j]
         *      B.min[i] += a < b ? a : b
         *      B.max[i] += a < b ? b : a
         *  return B
         */


        // const min = mat4.getTranslation([], nodeTransform);
        // const max = vec3.copy([], min);

        // for(let i = 0; i < 3; i++) {
        //   for(let j = 0; j < 3; j++) {
        //     const a = nodeTransform[i * 4 + j] * POSITION.min[j];
        //     const b = nodeTransform[i * 4 + j] * POSITION.max[j];
        //     min[i] += a < b ? a : b
        //     max[i] += a < b ? b : a
        //   }
        // }


        // const min = [ Infinity, Infinity, Infinity];
        // const max = [-Infinity,-Infinity,-Infinity];

        // const boxMin = vec3.create();
        // vec3.transformMat4(boxMin, POSITION.min, nodeTransform);

        // const boxMax = vec3.create();
        // vec3.transformMat4(boxMax, POSITION.max, nodeTransform);

        // const center = vec3.create();
        // vec3.add(center, boxMax, boxMin);
        // vec3.scale(center, center, 0.5);

        // const centerToSurface = vec3.create();
        // vec3.sub(centerToSurface, boxMax, center);

        // const radius = vec3.length(centerToSurface);

        // for (let i = 0; i < 3; i++) {
        //     min[i] = center[i] - radius;
        //     max[i] = center[i] + radius;
        // }

        return { min, max }
    }

    getNodeAABB(node) {
        const nodeTransform = this.getWorldTransform(node);

        const min = [Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity];

        if (node.mesh?.primitives) {
            for (const primitive of node.mesh.primitives) {
                if (primitive.attributes.POSITION) {
                    const { min: pMin, max: pMax } = this.getPrimitiveAABB(primitive, nodeTransform);

                    for (let i = 0; i < 3; i++) {
                        min[i] = Math.min(min[i], pMin[i]);
                        max[i] = Math.max(max[i], pMax[i]);
                    }
                }
            }
        }

        if (node.children) {
            for (const child of node.children) {
                const { min: nMin, max: nMax } = this.getNodeAABB(child);
                for (let i = 0; i < 3; i++) {
                    min[i] = Math.min(min[i], nMin[i]);
                    max[i] = Math.max(max[i], nMax[i]);
                }
            }
        }

        return { min, max };
    }

    getSceneAABB() {
        const { scene } = this;

        const min = [Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity];

        for (const node of scene.nodes) {
            if (!node.camera) {
                const { min: nMin, max: nMax } = this.getNodeAABB(node);
                for (let i = 0; i < 3; i++) {
                    min[i] = Math.min(min[i], nMin[i]);
                    max[i] = Math.max(max[i], nMax[i]);
                }
            }
        }

        return { min, max };
    }

    upload(frusta) {
        
        this.updateSkins();
        this.updateMorphs();
        
        this.gal.settings.upload();
        this.modelBuffer.upload();
        this.jointBuffer.upload();
        this.morphBuffer.upload();
        
        this.sort();
        
        const instances = [];
        for(const frustum of frusta) {
            frustum.upload();   
            instances.push(this.generateInstances(frustum));
        }
    
        return instances;
    }

    /**
     * @todo optimize this when ResizableArrayBuffers are stage 4
     */
    generateInstances(frustum) {
        const blocks = {
            opaque: [],
            transmissive: [],
            alpha: [],
        }  

        let bufferSize = 0, lastPrimitive = null, currentBlock = null;
        const processInstance = (blocks, instance) => {
            if(!frustum.containsAABB(instance.aabb)) return;

            const { index, primitive, node } = instance;
            const { morph, skin } = this.getState(node);

            if(primitive !== lastPrimitive) {
                currentBlock = { primitive, instances: [] };
                blocks.push(currentBlock);
            }

            currentBlock.instances.push(index, skin?.index || 0, morph?.index || 0, 0);
            bufferSize += 4;
            lastPrimitive = primitive;
        }

        const modelView = mat4.create(), depths = new Map();
        const getDepth = (instance) => {
            let depth = depths.get(instance);
            if(depth) return depth;

            const { primitive, worldTransform } = instance;

            mat4.multiply(modelView, frustum.viewMatrix, worldTransform);

            const centroid = this.calculateCentroid(primitive);
            const pos = vec3.transformMat4(vec3.create(), centroid, modelView);
            depth = pos[2];
            depths.set(instance, depth);
            return depth;
        }

        const byDepth = (a, b) => getDepth(a) - getDepth(b);

        for(const instance of this.instances.opaque){
            processInstance(blocks.opaque, instance);
        }

        for(const instance of this.instances.transmissive){
            processInstance(blocks.transmissive, instance);
        }
        
        for(const instance of this.instances.alpha.sort(byDepth)){
            processInstance(blocks.alpha, instance);
        }

        const data = new Uint32Array(bufferSize);
        const { opaque, transmissive, alpha } = blocks;
        let offset = 0;
        for(const type of [opaque, transmissive, alpha]){
            for(const block of type){
                data.set(block.instances, offset);
                
                block.offset = offset / 4;
                block.count  = block.instances.length / 4;
                offset += block.instances.length;
            }
        }

        const frustumInstances = this.getFrustumInstanceBuffer(frustum);
        /**
         * Grow or shrink the buffer if needed using a chunk size of 256
         */
        const chunksize = 256;
        if(bufferSize > frustumInstances.size || bufferSize < (frustumInstances.size - chunksize)) {
            frustumInstances.buffer?.destroy();
            frustumInstances.size   = roundUp(chunksize, bufferSize);
            frustumInstances.buffer = this.gal.device.createBuffer({ size: frustumInstances.size * 4, usage: BUFFER_USAGE.VERTEX | BUFFER_USAGE.COPY_DST });
        }

        if(frustumInstances.buffer)this.gal.device.queue.writeBuffer(frustumInstances.buffer, 0, data);
        
        return { blocks, buffer: frustumInstances.buffer };
    }

    sort() {
        const byPrimitiveId = (a, b) => a.primitive.$id - b.primitive.$id;
        this.instances.opaque.sort(byPrimitiveId);
        this.instances.transmissive.sort(byPrimitiveId);
        this.instances.alpha.sort(byPrimitiveId);
    }

    fitCameraToScene(cameraNode) {
        const { min, max } = this.getSceneAABB();
        const target = [], position = [];

        for (let i = 0; i < 3; i++) {
            target[i] = (max[i] + min[i]) / 2;
        }
        
        const height = Math.abs(max[1] - target[1]) * 2;
        const width  = Math.abs(max[0] - target[0]) * 2;

        const { perspective } = cameraNode.camera;

        const yfov = perspective.yfov;

        const idealDistance = Math.max(height, width) / Math.tan(yfov / 2);

        perspective.znear = idealDistance / 100;
        perspective.zfar  = idealDistance * 10;

        position[0] = target[0];
        position[1] = target[1];
        position[2] = target[2] + idealDistance;

        mat4.targetTo(cameraNode.matrix, position, target, [0, 1, 0]);

        this.updateNode(cameraNode);

        return { position, target, idealDistance };
    }

    #frustumInstanceBuffers = new WeakMap();
    getFrustumInstanceBuffer(frustum) {
        return this.#frustumInstanceBuffers.get(frustum) || this.#frustumInstanceBuffers.set(frustum, { size: 0 }).get(frustum)
    }

    #materialUBOs    = new WeakMap();
    #defaultMaterial = {};
    getMaterialUBO(material = this.#defaultMaterial){
        return this.#materialUBOs.get(material) || this.#materialUBOs.set(material, new Material(this.gal, material)).get(material);
    }

    getActiveMaterial(primitive) {
        return this.getMaterialUBO(primitive.extensions?.KHR_materials_variants?.mappings.find(mapping => {
            return mapping.variants.some(variant => variant === this.#activeVariant);
        })?.material || primitive.material);
    }

    #activeVariant;
    setActiveMaterialVariant(variant) {
        this.#activeVariant = variant;
    }

    updateMaterials(materials) {
        for(const material of materials) {
            this.getMaterialUBO(material).upload();
        }
    }

    deleteNode(node) {
        this.instances.opaque       = this.instances.opaque.filter(p => node != p.node);
        this.instances.transmissive = this.instances.transmissive.filter(p => node != p.node);
        this.instances.alpha        = this.instances.alpha.filter(p => node != p.node);

        for (const child of node.children) {
            this.deleteNode(child);
        }
    }
}

export default Graph;
