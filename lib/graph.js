import { vec3, mat3, mat4           } from '../deps/gl-matrix.js';
import { BUFFER_USAGE, SHADER_STAGE } from './constants.js';

import { Material         } from './material.js';
import { MatrixTBO, TBO   } from './tbo.js';
import { roundUp, groupBy, CacheMap } from './utils.js';

class ModelMatrixTBO extends MatrixTBO {
    static double = true;
    static layout = new MatrixTBO.Layout({ width: 64, height: 64, limit: 4 });
}

class JointMatrixTBO extends MatrixTBO {
    static double = true;
    static layout = new MatrixTBO.Layout({ width: 64, height: 64, limit: 4 });
}

class MorphMatrixTBO extends MatrixTBO {
    static double = true;
    static layout = new MatrixTBO.Layout({ width: 64, height: 64, limit: 4 });
}

class GameObjectTBO extends TBO {
    static layout = new TBO.Layout({ width: 64, height: 64, limit: 4 });
}

export class GameObjectFilter {
    constructor({ include, exclude } = {}) {
        this.include = include;
        this.exclude = exclude;
    }

    isInstanceExcluded({ gameObject }) {
        return gameObject && (this.exclude?.has(gameObject.id) || (this.include && !this.include.has(gameObject.id)));
    }
}

/**
 * Analyzes a scene and calculates new transforms for all nodes. It does this in a non destructive way by
 * keeping results in an internal state.
 * 
 * Buffers are written to texture buffer objects in a double buffer fashion.
 */
export class Graph {
    state      = new WeakMap();
    #centroids = new WeakMap();

    #bufferIndex = 0;
    #buffers = {};
    
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
            //modelMatrixHistory
            { binding: 4, visibility: SHADER_STAGE.VERTEX, texture: { viewDimension: '2d-array', sampleType: 'unfilterable-float' } },
            //jointMatrixHistory
            { binding: 5, visibility: SHADER_STAGE.VERTEX, texture: { viewDimension: '2d-array', sampleType: 'unfilterable-float' } },
            //morphMatrixHistory
            { binding: 6, visibility: SHADER_STAGE.VERTEX, texture: { viewDimension: '2d-array', sampleType: 'unfilterable-float' } },
            //gameObjectInfo
            { binding: 7, visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT, texture: { viewDimension: '2d-array', sampleType: 'unfilterable-float' } },
        ],
    };

    constructor(gal, scene) {
        this.gal = gal;

        this.scene = scene;

        this.#buffers = {
            model: new ModelMatrixTBO(gal),
            joint: new JointMatrixTBO(gal),
            morph: new MorphMatrixTBO(gal),

            gameObject: new GameObjectTBO(gal),
        }

        /**
         * Arrays of { index, node, primitive, worldTransform, aabb, frontFace }
         */
        this.instances = {
            opaque:       [],
            transmissive: [],
            alpha:        [],
            outline:      [],
        };


        /**
         * Set of nodes that have skins
         */
        this.skins = new Set();

        /**
         * Set of nodes that have morphs
         */
        this.morphs = new Set();

        /**
         * Set of nodes that have a light
         */
        this.lights = new Set();

        /**
         * Set of materials used in scene
         */
        this.materials = new Set();

        /** Set of audio emitters */
        this.audio = new Set();

        this.updateScene();
    }

    run(settings) {
        this.updateBindGroup(settings);
        this.upload(settings);
        this.#bufferIndex = ++this.#bufferIndex % 2;
    }

    updateBindGroup(settings) {
        const { model, joint, morph, gameObject } = this.#buffers;
        const history = (this.#bufferIndex + 1) % 2;
        const entries = [
            //settings
            { binding: 0, resource: { buffer: settings.buffer } },
            //modelMatrix
            { binding: 1, resource: model.textureViews[this.#bufferIndex] },
            //jointMatrix
            { binding: 2, resource: joint.textureViews[this.#bufferIndex] },
            //morphMatrix
            { binding: 3, resource: morph.textureViews[this.#bufferIndex] },
            //modelMatrixHistory
            { binding: 4, resource: model.textureViews[history] },
            //jointMatrixHistory
            { binding: 5, resource: joint.textureViews[history] },
            //morphMatrixHistory
            { binding: 6, resource: morph.textureViews[history] },
            //gameObjectInfo
            { binding: 7, resource: gameObject.textureView },
        ];

        this.bindGroup = this.gal.device.createBindGroup({
            label: 'Graph BindGroup',
            layout: this.gal.device.createBindGroupLayout(Graph.bindGroupLayout),
            entries,
        });
    }

    get environment() {
        return this.scene.extensions?.KHR_lights_environment?.light;
    }

    clear() {
        this.instances.opaque.length       = 0;
        this.instances.transmissive.length = 0;
        this.instances.alpha.length        = 0;
        this.instances.outline.length    = 0;

        this.lights.clear();
        this.skins.clear();
        this.morphs.clear();
        this.materials.clear();
        this.audio.clear();
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
        const stride = (accessor.bufferView?.byteStride ?? 12) / 4;

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

            if(node.extensions?.REV_game_object) {
                state.gameObject = this.getGameObjectState(node.extensions.REV_game_object);
            }

            if (!node.mesh) {
                state.worldTransform = mat4.create();
                state.free = () => {
                    if(node.extensions?.REV_game_object) state.gameObject.free();
                    this.state.delete(node);
                }
            } else {
                const { offset, views, free } = this.#buffers.model.createMatrixViewBlock(2);
                state.worldTransform  = views[0];
                state.modelMatrix     = views[0];
                state.normalMatrix    = views[1];
                state.index     = offset / 64;
    
                state.worldTransformInverse = mat4.create();

                if(node.skin) {
                    state.skin = this.getSkinState(node.skin);
                }
        
                const weights = node.weights ?? node.mesh.weights;
                if(weights) {
                    state.morph = this.getMorphState(weights);
                }

                state.free = () => {
                    free();
                    state.skin?.free();
                    state.morph?.free();
                    if(node.extensions?.REV_game_object) state.gameObject.free();
                    this.state.delete(node);
                };
            }

            this.state.set(node, state);
        }

        if(node.extensions?.REV_game_object) {
            state.gameObject ??= this.getGameObjectState(node.extensions.REV_game_object);
        }

        return state;
    }

    getSkinState(skin) {
        let state = this.state.get(skin);
        if(!state) {
            const { offset, views, free } = this.#buffers.joint.createMatrixViewBlock(skin.joints.length * 2);

            state = {
                index: offset / 64,
                jointMatrices: views,
                free: () => {
                    free();
                    this.state.delete(skin);
                }, 
            };

            this.state.set(skin, state);
        } 
        return state;
    }

    getMorphState(weights) {
        let state = this.state.get(weights);
        if(!state) {
            const { offset, views, free } = this.#buffers.morph.createMatrixViewBlock(Math.ceil(weights.length / 16))

            state = {
                index: offset / 64,
                weights: views,
                free: () => {
                    free();
                    this.state.delete(weights);
                }, 
            };

            this.state.set(weights, state);
        } 
        return state;
    }

    #gameObjectsByIndex = new Map();
    getGameObjectState(REV_game_object) {
        let state = this.state.get(REV_game_object);
        if(!state) {
            const { offset, view, free } = this.#buffers.gameObject.createViewBlock(4);

            state = {
                id: REV_game_object.id,
                index: offset / 16,
                hidden: false,
                outline: view,
                free: () => {
                    free();
                    this.state.delete(REV_game_object);
                    this.#gameObjectsByIndex.delete(state.index);
                }, 
            }

            this.state.set(REV_game_object, state);
            this.#gameObjectsByIndex.set(state.index, state.id);
        }
        return state;
    }

    getGameObjectIdByIndex(index) {
        return this.#gameObjectsByIndex.get(index);
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
     * Adds a node to the scene and updates the graph
     */
    addNode(node) {
        if(this.scene.nodes.indexOf(node) === -1) this.scene.nodes.push(node);
        this.updateNode(node);
    }


    /**
     * Updates the node's transform information relative to the parent Transform.
     * @param {Node} node - The node to update
     */
    updateNode(node) {
        const { matrix, mesh } = node;
        const nodeState = this.getState(node);

        const {
            localTransform,
            worldTransform,
            worldTransformInverse,
            normalMatrix,
            parent,
            index,
            skin, 
            morph,
            gameObject,
            
        } = nodeState;
        
        const parentState = parent ? this.getState(parent) : null;

        if (matrix) {
            mat4.copy(localTransform, matrix);
        } else {
            const { translation = [0.0, 0.0, 0.0], rotation = [0.0, 0.0, 0.0, 1.0], scale = [1.0, 1.0, 1.0] } = node;
            mat4.fromRotationTranslationScale(localTransform, rotation, translation, scale);
        }
        
        // Update world transform
        mat4.copy(worldTransform, localTransform);
        mat4.mul(worldTransform, parentState?.worldTransform ?? mat4.create(), localTransform);

        if (node.extensions?.KHR_lights_punctual) {
            this.lights.add(node);
        }

        if(node.extensions?.KHR_audio) {
            this.audio.add(node);
        }

        if(node.extensions?.REV_game_object) {
            gameObject.hidden = node.extensions.REV_game_object.hidden;
            gameObject.outline.set(node.extensions.REV_game_object.outline ?? [0, 0, 0, 0]);
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
            this.instances.outline      = this.instances.outline.filter(p => node != p.node);

            const frontFace = mat4.determinant(worldTransform) < 0 ? 'cw': 'ccw';

            for (const primitive of mesh.primitives) {
                const aabb = this.getPrimitiveAABB(primitive, worldTransform);
                const instance = { index, node, primitive, skin, morph, worldTransform, aabb, frontFace, gameObject };

                if(gameObject?.outline[3] > 0) {
                    this.instances.outline.push(instance);
                }

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

                this.materials.add(primitive.material);
            }

            if (skin) {
                this.skins.add(node);
            }
    
            if (morph) {
                this.morphs.add(node);
            }

            
        }

        for (const child of node.children) {
            const childState = this.getState(child);
            
            childState.parent = node;
            childState.gameObject ??= gameObject;

            this.updateNode(child);
        }
    }

    /**
     * Updates a set of nodes while avoiding redundant updates by using BFS
     * Assumes scene is a true Tree and nodes only exist once, as per the glTF spec.
     */
    updateNodes(nodes, root = this.scene) {
        const search = [...(root.nodes ?? root.children)];

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
                const jointMatrix       = jointMatrices[i * 2];
                const jointNormalMatrix = jointMatrices[i * 2 + 1];
                
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
                weights[i].set(src.slice(i * 16, i * 16 + 16));
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

        const min = vec3.sub(vec3.create(), center, extents);
        const max = vec3.add(vec3.create(), center, extents);

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
            const { min: nMin, max: nMax } = this.getNodeAABB(node);
            for (let i = 0; i < 3; i++) {
                min[i] = Math.min(min[i], nMin[i]);
                max[i] = Math.max(max[i], nMax[i]);
            }
        }

        return { min, max };
    }

    upload(settings) {
        settings.upload();

        this.updateSkins();
        this.updateMorphs();
        
        this.#buffers.model.upload(this.#bufferIndex);
        this.#buffers.joint.upload(this.#bufferIndex);
        this.#buffers.morph.upload(this.#bufferIndex);
        this.#buffers.gameObject.upload();
    }

    /**
     * @todo optimize this when ResizableArrayBuffers are stage 4
     */
    generateInstances({ frustum, filter, sortAlpha }) {

        const isCulled      = (instance) => !frustum.containsAABB(instance.aabb) || filter?.isInstanceExcluded(instance) || instance.gameObject?.hidden;
        const byPrimitiveId = (instance) => isCulled(instance) ? null : (instance.primitive.$id + '|' + instance.frontFace);

        const batches = {
            opaque:       groupBy(this.instances.opaque,       byPrimitiveId),
            transmissive: groupBy(this.instances.transmissive, byPrimitiveId),
            alpha:        groupBy(this.instances.alpha,        byPrimitiveId),
            outline:      groupBy(this.instances.outline,      byPrimitiveId),
        }

        const blocks = this.#getInstanceBlocks(frustum);

        const gameObjects = {};

        for(const [type, block] of Object.entries(blocks)) {
            block.batches = [];

            const bufferSize = (this.instances[type].length - (batches[type][null]?.length ?? 0)) * 4;
            
            delete batches[type][null]; // remove culled and filtered objects

            this.#ensureInstanceBufferSize(block, bufferSize);

            const data = new Uint32Array(bufferSize);

            let i = 0;
            for(const batch of Object.values(batches[type])) {
                const { primitive, frontFace } = batch[0];

                const count = batch.length;
                const instances = [];

                block.batches.push({ offset: i / 4, count, primitive, frontFace, instances });
                for(const { index, morph, skin, gameObject, worldTransform } of batch) {
                    
                    instances.push(worldTransform);

                    /** 
                     * When rendering game objects it's not genreally useful to use instancing (such as with querying), 
                     * so we can just store references to one of the other buffers and render them one at a time.
                     * we can skip the outline block because the instance should already be present in of the other blocks.
                     */
                    if(gameObject && type !== 'outline') { //
                        gameObjects[gameObject.id] ??= [];
                        gameObjects[gameObject.id].push({ buffer: block.buffer, offset: i / 4, primitive, frontFace });
                    }

                    data[i++] = index;
                    data[i++] = skin?.index ?? 0;
                    data[i++] = morph?.index ?? 0;
                    data[i++] = gameObject?.index ?? 0;
                }
            }

            block.data = data;

            if(bufferSize) this.gal.device.queue.writeBuffer(block.buffer, 0, data);
        }

        if(sortAlpha) {
            const block = blocks.alpha;

            block.sorted = [];
            
            const modelView = mat4.create(), pos = vec3.create()

            for(const batch of block.batches) {
                const { offset, primitive, frontFace, instances } = batch;

                let i = 0;
                for(const worldTransform of instances){
                    mat4.multiply(modelView, frustum.viewMatrix, worldTransform);
                    vec3.transformMat4(pos, this.calculateCentroid(primitive), modelView);
                    block.sorted.push({ offset: offset + (i++ * 4), primitive, frontFace, depth: pos[2] });
                }
                
            }
            block.sorted.sort((a, b) => a.depth - b.depth);
        }

        return { ...blocks, gameObjects };
    }

    #instanceBlockCache = new CacheMap();
    #getInstanceBlocks(frustum) {
        const instanceBlocks = this.#instanceBlockCache.get(frustum);

        instanceBlocks.opaque       ??= { size: 0 };
        instanceBlocks.transmissive ??= { size: 0 };
        instanceBlocks.alpha        ??= { size: 0 };
        instanceBlocks.outline      ??= { size: 0 };

        return instanceBlocks;
    }

    
    #ensureInstanceBufferSize(block, bufferSize) {
        /**
         * Grow or shrink the buffer if needed using a chunk size of 256
         */
        const chunksize = 256;
        if(bufferSize > block.size ?? bufferSize < (block.size - chunksize)) {
            block.buffer?.destroy();
            block.size   = roundUp(chunksize, bufferSize);
            block.buffer = this.gal.device.createBuffer({ size: block.size * 4, usage: BUFFER_USAGE.VERTEX | BUFFER_USAGE.COPY_DST });
        }
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
        return this.#frustumInstanceBuffers.get(frustum) ?? this.#frustumInstanceBuffers.set(frustum, { size: 0 }).get(frustum)
    }

    #materialUBOs    = new WeakMap();
    #defaultMaterial = {};
    getMaterialUBO(material = this.#defaultMaterial){
        return this.#materialUBOs.get(material) ?? this.#materialUBOs.set(material, new Material(this.gal, material)).get(material);
    }

    getActiveMaterial(primitive) {
        return this.getMaterialUBO(primitive.extensions?.KHR_materials_variants?.mappings.find(mapping => {
            return mapping.variants.some(variant => variant === this.#activeVariant);
        })?.material ?? primitive.material);
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

    /**
     * Removes a node from the graph and scene
     */
    deleteNode(node) {
        this.instances.opaque       = this.instances.opaque.filter(p => node != p.node);
        this.instances.transmissive = this.instances.transmissive.filter(p => node != p.node);
        this.instances.alpha        = this.instances.alpha.filter(p => node != p.node);
        this.instances.outline      = this.instances.alpha.filter(p => node != p.node);

        for (const child of node.children) {
            this.deleteNode(child);
        }

        const index = this.scene.nodes.indexOf(node);
        if(index !== -1) {
            this.scene.nodes.splice(index, 1);
        }

        this.state.get(node)?.free();
    }
}

export default Graph;
