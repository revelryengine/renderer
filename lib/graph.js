import { vec3, mat3, mat4           } from '../deps/gl-matrix.js';
import { BUFFER_USAGE, SHADER_STAGE } from './constants.js';

import { Material         } from './material.js';
import { MatrixTBO, TBO   } from './tbo.js';
import { WeakCache, groupBy,roundUp } from '../deps/utils.js';

class ModelMatrixTBO extends MatrixTBO.Layout({ width: 64, height: 64, limit: 4, double: true }) {}

class JointMatrixTBO extends MatrixTBO.Layout({ width: 64, height: 64, limit: 4, double: true }) {}

class MorphMatrixTBO extends MatrixTBO.Layout({ width: 64, height: 64, limit: 4, double: true }) {}

class GameObjectTBO extends TBO.Layout({ width: 64, height: 64, limit: 4 }) {}

export class GameObjectFilter {
    /**
     * @param {GameObjectFilterOptions} [options]
     */
    constructor({ include, exclude } = {}) {
        this.include = include;
        this.exclude = exclude;
    }

    /**
     * @param {{ gameObject?: { id: string } }} options
     */
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
    state = {
        nodes:       /** @type {WeakMap<Node,NodeState> } */(new WeakMap()),
        meshes:      /** @type {WeakMap<Mesh, MeshState>} */(new WeakMap()),
        skins:       /** @type {WeakMap<Skin, SkinState> } */(new WeakMap()),
        morphs:      /** @type {WeakMap<number[], MorphState> } */(new WeakMap()),
        gameObjects: /** @type {WeakMap<REVGameObjectNode, GameObjectState> } */(new WeakMap()),
    }

    #centroids = new WeakMap();

    #bufferIndex = 0;

    #buffers;

    /**
     * Arrays of { index, node, primitive, worldTransform, aabb, frontFace }
     */
    instances = {
        opaque:       /** @type {NodeInstance[]} */([]),
        transmissive: /** @type {NodeInstance[]} */([]),
        alpha:        /** @type {NodeInstance[]} */([]),
        outline:      /** @type {NodeInstance[]} */([]),
    };

    /**
     * Set of nodes that have skins
     * @type {Set<SkinNode>}
     */
    skins = new Set();

    /**
     * Set of nodes that have morphs
     * @type {Set<MeshNode>}
     */
    morphs = new Set();

    /**
     * Set of nodes that have a light
     * @type {Set<LightNode>}
     */
    lights = new Set();

    /**
     * Set of nodes that have an audio emitter
     * @type {Set<EmitterNode>}
     */
    emitters = new Set();

    /**
     * Set of materials used in scene
     * @type {Set<import('../deps/gltf.js').Material>}
     */
    materials = new Set();

    static bindGroupLayout = /** @type {const} */({
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
    });

    /**
     * @param {import('./revgal.js').RevGAL} gal
     * @param {Scene} scene
     */
    constructor(gal, scene) {
        this.gal = gal;

        this.scene = scene;

        this.#buffers = {
            model: new ModelMatrixTBO(this.gal),
            joint: new JointMatrixTBO(this.gal),
            morph: new MorphMatrixTBO(this.gal),

            gameObject: new GameObjectTBO(this.gal),
        };

        this.updateScene();
    }

    /**
     * @param {import('./ubo.js').UBO} settings
     */
    run(settings) {
        this.updateBindGroup(settings);
        this.upload(settings);
        this.#bufferIndex = ++this.#bufferIndex % 2;
    }

    /**
     * @param {import('./ubo.js').UBO} settings
     */
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
        return this.scene.extensions?.KHR_environment_map?.environment_map;
    }

    clear() {
        this.instances.opaque.length       = 0;
        this.instances.transmissive.length = 0;
        this.instances.alpha.length        = 0;
        this.instances.outline.length      = 0;

        this.lights.clear();
        this.skins.clear();
        this.morphs.clear();
        this.materials.clear();
        this.emitters.clear();
    }

    updateScene() {
        for (const node of this.scene.nodes) {
            this.updateNode(node);
        }
    }

    /**
     * Caclulates the centroid of a primitive. Useful for alpha sort ordering based on centroid depth from camera.
     * https://github.com/KhronosGroup/glTF-Sample-Viewer/blob/d32ca25dc273c0b0982e29efcea01b45d0c85105/src/gltf_utils.js#L88
     * @param {MeshPrimitive} primitive
     */
    calculateCentroid(primitive) {
        let centroid = this.#centroids.get(primitive);
        if (centroid) return centroid;

        const accessor = primitive.attributes.POSITION;

        if(!accessor) throw new Error('Unable to calculate centroid without POSITION attribute');

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
     */
    getNodeState(node) {
        let state = this.state.nodes.get(node); //weakmap is kind of slow, come back to this
        if (!state) {

            state = {
                parent: null,
                localTransform: mat4.create(),
                worldTransform: mat4.create(),

                mesh:  node.mesh    ? this.getMeshState(node.mesh)     : undefined,
                skin:  node.skin    ? this.getSkinState(node.skin)     : undefined,
                morph: node.weights ? this.getMorphState(node.weights) : undefined,

                free: () => {
                    state?.gameObject?.free();
                    if(node.extensions?.KHR_lights_punctual) this.lights.delete(/** @type {LightNode}*/(node));
                    if(node.extensions?.KHR_audio) this.emitters.delete(/** @type {EmitterNode}*/(node));
                    this.state.nodes.delete(node);
                },
            };

            if(state.mesh) {
                state.worldTransform = state.mesh.worldTransform;
                state.morph ??= state.mesh.morph;
            }

            this.state.nodes.set(node, state);
        }

        if(node.extensions?.REV_game_object) {
            state.gameObject ??= this.getGameObjectState(node.extensions.REV_game_object);
        }

        return state;
    }

    /**
     * @param {import('../deps/gltf.js').Mesh} mesh
     */
    getMeshState(mesh) {
        let state = this.state.meshes.get(mesh);
        if(!state) {
            const { offset, views, free } = this.#buffers.model.createMatrixViewBlock(2);

            state = {
                index:          offset / 64,
                worldTransform: views[0],
                modelMatrix:    views[0],
                normalMatrix:   views[1],

                worldTransformInverse: mat4.create(),
                morph: mesh.weights ? this.getMorphState(mesh.weights) : undefined,

                free: () => {
                    free();
                    state?.morph?.free();
                }
            }

            this.state.meshes.set(mesh, state);
        }
        return state;
    }

    /**
     * @param {import('../deps/gltf.js').Skin} skin
     */
    getSkinState(skin) {
        let state = this.state.skins.get(skin);
        if(!state) {
            const { offset, views, free } = this.#buffers.joint.createMatrixViewBlock(skin.joints.length * 2);

            state = {
                index: offset / 64,
                jointMatrices: views,
                free: () => {
                    free();
                    this.state.skins.delete(skin);
                },
            };

            this.state.skins.set(skin, state);
        }
        return state;
    }

    /**
     * @param {number[]} weights
     */
    getMorphState(weights) {
        let state = this.state.morphs.get(weights);
        if(!state) {
            const { offset, views, free } = this.#buffers.morph.createMatrixViewBlock(Math.ceil(weights.length / 16))

            state = {
                index: offset / 64,
                weights: views,
                free: () => {
                    free();
                    this.state.morphs.delete(weights);
                },
            };

            this.state.morphs.set(weights, state);
        }
        return state;
    }

    #gameObjectsByIndex = new Map();
    /**
     * @param {REVGameObjectNode} REV_game_object
     */
    getGameObjectState(REV_game_object) {
        let state = this.state.gameObjects.get(REV_game_object);
        if(!state) {
            const { offset, view, free } = this.#buffers.gameObject.createViewBlock(4);

            state = {
                id: REV_game_object.id,
                index: offset / 16,
                hidden: false,
                outline: view,
                free: () => {
                    free();
                    this.state.gameObjects.delete(REV_game_object);
                    this.#gameObjectsByIndex.delete(/** @type {{ index: number }}*/(state).index);
                },
            }

            this.state.gameObjects.set(REV_game_object, state);
            this.#gameObjectsByIndex.set(state.index, state.id);
        }
        return state;
    }

    /**
     * @param {number} index
     */
    getGameObjectIdByIndex(index) {
        return this.#gameObjectsByIndex.get(index);
    }

    /**
     * Returns the local transform matrix.
     * @param {Node} node
     * @returns {mat4}
     */
    getLocalTransform(node) {
        return this.getNodeState(node).localTransform;
    }

    /**
     * Returns the world transform matrix based on last update.
     * @param {Node} node
     * @returns {mat4}
     */
    getWorldTransform(node) {
        return this.getNodeState(node).worldTransform;
    }

    /**
     * Returns the parent of the node
     * @param {Node} node
     */
    getParent(node) {
        return this.getNodeState(node).parent;
    }

    /**
     * Adds a node to the scene and updates the graph
     * @param {Node} node
     */
    addNode(node) {
        if(this.scene.nodes.indexOf(node) === -1) this.scene.nodes.push(node);
        this.updateNode(node);
    }


    /**
     * Updates the node's transform information relative to the parent Transform.
     *
     * @param {Node} node - The node to update
     */
    updateNode(node) {
        const { matrix, mesh } = node;
        const nodeState = this.getNodeState(node);

        const {
            parent,
            localTransform,
            worldTransform,
            mesh:       meshState,
            skin:       skinState,
            morph:      morphState,
            gameObject: gameObjectState,
        } = nodeState;

        const parentState = parent ? this.getNodeState(parent) : null;

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
            this.lights.add(/** @type {LightNode} */(node));
        }

        if(node.extensions?.KHR_audio) {
            this.emitters.add(/** @type {EmitterNode}*/(node));
        }

        if(gameObjectState && node.extensions?.REV_game_object) {
            gameObjectState.hidden = !!node.extensions.REV_game_object.hidden;
            gameObjectState.outline.set(node.extensions.REV_game_object.outline ?? [0, 0, 0, 0]);
        }

        if (mesh && meshState) {
            const { index, worldTransformInverse, normalMatrix } = meshState;
            // Update world transform inverse
            mat4.invert(worldTransformInverse, worldTransform);

            // Update normal matrix
            mat4.transpose(normalMatrix, worldTransformInverse);

            //Clear any primitives from a previous update
            this.instances.opaque       = this.instances.opaque.filter(p => node != p.node);
            this.instances.transmissive = this.instances.transmissive.filter(p => node != p.node);
            this.instances.alpha        = this.instances.alpha.filter(p => node != p.node);
            this.instances.outline      = this.instances.outline.filter(p => node != p.node);

            const frontFace = /** @type {'cw'|'ccw'}*/(mat4.determinant(worldTransform) < 0 ? 'cw': 'ccw');

            for (const primitive of mesh.primitives) {
                const aabb = this.getPrimitiveAABB(primitive, worldTransform);
                const instance = { index, node, primitive, skin: skinState, morph: morphState, gameObject: gameObjectState, worldTransform, aabb, frontFace };

                if(gameObjectState && gameObjectState.outline[3] > 0) {
                    this.instances.outline.push(instance);
                }

                if (!primitive.material) {
                    this.instances.opaque.push(instance);
                    continue;
                }

                if (primitive.material.alphaMode === 'BLEND' || primitive.material.alphaMode === 'MASK') {
                    this.instances.alpha.push(instance);
                } else if (primitive.material.extensions?.KHR_materials_transmission) {
                    this.instances.transmissive.push(instance);
                } else {
                    this.instances.opaque.push(instance);
                }

                this.materials.add(primitive.material);
            }

            if (skinState) {
                this.skins.add(/** @type {SkinNode}*/(node));
            }

            if (morphState) {
                this.morphs.add(/** @type {MeshNode}*/(node));
            }
        }

        for (const child of node.children) {
            const childState = this.getNodeState(child);

            childState.parent = node;
            childState.gameObject ??= gameObjectState;

            this.updateNode(child);
        }
    }

    /**
     * Updates a set of nodes while avoiding redundant updates by using BFS
     * Assumes scene is a true Tree and nodes only exist once, as per the glTF spec.
     *
     * @param {Set<Node>} nodes
     * @param {Node|Scene} root
     */
    updateNodes(nodes, root = this.scene) {
        const search = [...('nodes' in root ? root.nodes : root.children)];

        while (search.length) {
            const node = /** @type {Node} */(search.shift());
            if (nodes.has(node)) {
                this.updateNode(node);
            } else {
                search.push(...node.children);
            }
        }
    }

    updateSkins() {
        for (const node of this.skins) {
            const { skin, mesh } = this.getNodeState(node);

            if(skin && mesh && node.skin) {

                const { jointMatrices } = skin;
                const { worldTransformInverse } = mesh

                for (let i = 0; i < node.skin.joints.length; i++) {
                    const jointMatrix       = jointMatrices[i * 2];
                    const jointNormalMatrix = jointMatrices[i * 2 + 1];

                    const jointTransform = this.getWorldTransform(node.skin.joints[i]);
                    const inverseBindMatrix = node.skin.inverseBindMatrices?.createTypedView(i * 16, 1) ?? mat4.create();

                    mat4.mul(jointMatrix, jointTransform, inverseBindMatrix);
                    mat4.mul(jointMatrix, worldTransformInverse, jointMatrix);

                    mat4.invert(jointNormalMatrix, jointMatrix);
                    mat4.transpose(jointNormalMatrix, jointNormalMatrix);
                }
            }
        }
    }

    updateMorphs() {
        for(const node of this.morphs) {
            const { morph } = this.getNodeState(node);
            if(morph) {
                const { weights } = morph;
                const src = node.weights ?? node.mesh.weights ?? [];
                for(let i = 0; i < weights.length; i++) {
                    weights[i].set(src.slice(i * 16, i * 16 + 16));
                }
            }
        }
    }

    /**
     * @param {MeshPrimitive} primitive
     * @param {mat4} nodeTransform
     */
    getPrimitiveAABB(primitive, nodeTransform) {
        const { POSITION } = primitive.attributes;
        if(!POSITION) throw new Error('Unable to get bounding box without POSITION attribute');
        if(!POSITION.min || !POSITION.max) throw new Error('Invalid gltf attribute POSITION must have min and max');

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

        return { min, max }
    }

    /**
     * @param {Node} node
     */
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

    /**
     * @param {import('./ubo.js').UBO} settings
     */
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
     *
     * @param {{ frustum: Frustum, filter?: GameObjectFilter, sortAlpha?: boolean }} options
     */
    generateInstances({ frustum, filter, sortAlpha }) {

        const isCulled      = /** @param {NodeInstance} instance */(instance) => !frustum.containsAABB(instance.aabb) || filter?.isInstanceExcluded(instance) || instance.gameObject?.hidden;
        const byPrimitiveId = /** @param {NodeInstance} instance */(instance)=> isCulled(instance) ? 'null' : (instance.primitive.$id + '|' + instance.frontFace);

        const batches = {
            opaque:       groupBy(this.instances.opaque,       byPrimitiveId),
            transmissive: groupBy(this.instances.transmissive, byPrimitiveId),
            alpha:        groupBy(this.instances.alpha,        byPrimitiveId),
            outline:      groupBy(this.instances.outline,      byPrimitiveId),
        }

        const blocks = this.#getInstanceBlocks(frustum);

        const gameObjects = /** @type {Record<string, GameObjectInstanceBlock[]>} */({});

        for(const entry of Object.entries(blocks)) {
            const [type, block] = /** @type {[InstanceType, InstanceBlock]} */(entry);
            block.batches = [];

            const bufferSize = (this.instances[type].length - (batches[type]['null']?.length ?? 0)) * 4;

            delete batches[type]['null']; // remove culled and filtered objects

            this.#ensureInstanceBufferSize(block, bufferSize);

            block.data = new Uint32Array(bufferSize);

            let i = 0;
            for(const batch of Object.values(batches[type])) {
                const { primitive, frontFace } = batch[0];

                const count = batch.length;
                const instances = /** @type {mat4[]} */([]);

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

                    block.data[i++] = index;
                    block.data[i++] = skin?.index ?? 0;
                    block.data[i++] = morph?.index ?? 0;
                    block.data[i++] = gameObject?.index ?? 0;
                }
            }

            if(bufferSize) this.gal.device.queue.writeBuffer(block.buffer, 0, block.data);
        }

        if(sortAlpha) {
            const block = blocks.alpha;

            block.sorted = /** @type {SortedInstanceBlock[]} */([]);

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

    /** @type {WeakCache<Record<InstanceType, InstanceBlock> & Record<'alpha', InstanceBlock & { sorted?: SortedInstanceBlock[]}>>} */
    #instanceBlockCache = new WeakCache();

    /**
     * @param {Frustum} frustum
     */
    #getInstanceBlocks(frustum) {
        const instanceBlocks = this.#instanceBlockCache.ensure(frustum, () => ({
            opaque       : { size: 0, batches: [], data: new Uint32Array(0) },
            transmissive : { size: 0, batches: [], data: new Uint32Array(0) },
            alpha        : { size: 0, batches: [], data: new Uint32Array(0) },
            outline      : { size: 0, batches: [], data: new Uint32Array(0) },
        }));

        return instanceBlocks;
    }

    /**
     * @param {InstanceBlock} block
     * @param {number} bufferSize
     * @return {asserts block is { buffer: import('./revgal.js').REVBuffer }}
     */
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

    /**
     * @param {import('./frustum.js').CameraNode} cameraNode
     */
    fitCameraToScene(cameraNode) {
        const nodeTransform = this.getWorldTransform(cameraNode);

        const { min, max } = this.getSceneAABB();
        const target = vec3.create(), position = vec3.create(), extents = vec3.create();

        vec3.add(target, max, min);
        vec3.scale(target, target, 0.5);

        vec3.sub(extents, max, target);

        const abs = mat3.create();
        mat3.fromMat4(abs, nodeTransform);

        for (let i = 0; i < abs.length; i++) {
            abs[i] = Math.abs(abs[i]);
        }

        vec3.transformMat3(extents, extents, abs);

        vec3.add(extents, target, extents)

        for (let i = 0; i < 3; i++) {
            target[i] = (max[i] + min[i]) / 2;
        }

        const height = Math.abs(extents[1] - target[1]) * 2;
        const width  = Math.abs(extents[0] - target[0]) * 2;

        const details = cameraNode.camera.getDetails();

        const yfov = 'yfov' in details ? details.yfov : details.ymag;

        const idealDistance = Math.max(height, width) / Math.tan(yfov / 2);

        details.znear = idealDistance / 100;
        details.zfar  = idealDistance * 10;

        position[0] = target[0];
        position[1] = target[1];
        position[2] = target[2] + idealDistance;

        cameraNode.matrix ??= mat4.create();

        mat4.targetTo(cameraNode.matrix, position, target, [0, 1, 0]);

        this.updateNode(cameraNode);

        return { position, target, idealDistance };
    }

    #frustumInstanceBuffers = new WeakMap();
    /**
     * @param {Frustum} frustum
     */
    getFrustumInstanceBuffer(frustum) {
        return this.#frustumInstanceBuffers.get(frustum) ?? this.#frustumInstanceBuffers.set(frustum, { size: 0 }).get(frustum)
    }

    #materialUBOs    = new WeakMap();
    getMaterialUBO(material = Material.DEFAULT_MATERIAL){
        return this.#materialUBOs.get(material) ?? this.#materialUBOs.set(material, new Material(this.gal, material)).get(material);
    }

    /**
     * @param {MeshPrimitive} primitive
     */
    getActiveMaterial(primitive) {
        return this.getMaterialUBO(primitive.extensions?.KHR_materials_variants?.mappings.find(mapping => {
            return mapping.variants.some(variant => variant === this.#activeVariant);
        })?.material ?? primitive.material);
    }

    /**
     * @type {import('../deps/gltf.js').KHRMaterialsVariantsVariant|null}
     */
    #activeVariant = null;

    /**
     * @param {import('../deps/gltf.js').KHRMaterialsVariantsVariant} variant
     */
    setActiveMaterialVariant(variant) {
        this.#activeVariant = variant;
    }

    /**
     * @param {Set<import('../deps/gltf.js').Material>} materials
     */
    updateMaterials(materials) {
        for(const material of materials) {
            this.getMaterialUBO(material).upload();
        }
    }

    /**
     * @param {{
     *  '/nodes': Set<Node>
     *  '/materials': Set<import('../deps/gltf.js').Material>,
     * }} targets
     */
    updateAnimationTargets(targets) {
        for(const k in targets) {
            switch(k) {
                case '/nodes':
                    this.updateNodes(targets[k]);
                    break;
                case '/materials':
                    this.updateMaterials(targets[k]);
                    break;
            }
        }
    }

    /**
     * Removes a node from the graph and scene
     * @param {Node} node
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

        this.state.nodes.get(node)?.free();
    }
}

/**
 * @typedef {import('../deps/gltf.js').Node} Node
 * @typedef {import('../deps/gltf.js').Scene} Scene
 * @typedef {import('../deps/gltf.js').Mesh} Mesh
 * @typedef {import('../deps/gltf.js').MeshPrimitive} MeshPrimitive
 * @typedef {import('../deps/gltf.js').Skin} Skin
 * @typedef {import('../deps/gltf.js').REVGameObjectNode} REVGameObjectNode
 * @typedef {import('./frustum.js').Frustum} Frustum
 *
 * @typedef {Node & { skin: import('../deps/gltf.js').Skin }} SkinNode
 * @typedef {Node & { mesh: import('../deps/gltf.js').MeshPrimitive }} MeshNode
 * @typedef {Node & { extensions: { KHR_lights_punctual: { light: import('../deps/gltf.js').KHRLightsPunctualNode } } }} LightNode
 * @typedef {Node & { extensions: { KHR_audio: { emitter: import('../deps/gltf.js').KHRAudioEmitter } } }} EmitterNode
 *
 * @typedef {{
*  index:          number,
*  node:           Node,
*  primitive:      MeshPrimitive,
*  skin?:          ReturnType<Graph['getSkinState']>,
*  morph?:         ReturnType<Graph['getMorphState']>,
*  gameObject?:    ReturnType<Graph['getGameObjectState']>
*  worldTransform: mat4,
*  aabb:           { min: vec3, max: vec3 },
*  frontFace:      'cw'|'ccw',
* }} NodeInstance
*
* @typedef {'opaque'|'transmissive'|'alpha'|'outline'} InstanceType
* @typedef {{ offset: number, count: number, primitive: MeshPrimitive, frontFace: 'cw'|'ccw', instances: mat4[] }} InstanceBatch
* @typedef {{ size: number, batches: InstanceBatch[], buffer?: import('./revgal.js').REVBuffer, data: Uint32Array }} InstanceBlock
* @typedef {{ buffer: import('./revgal.js').REVBuffer, offset: number, primitive: MeshPrimitive, frontFace: 'cw'|'ccw' }} GameObjectInstanceBlock
* @typedef {{  offset: number, primitive: MeshPrimitive, frontFace: 'cw'|'ccw', depth: number }} SortedInstanceBlock
*
* @typedef {{ index: number, jointMatrices: Float32Array[], free: () => void }} SkinState
* @typedef {{ index: number, weights: Float32Array[], free: () => void }} MorphState
* @typedef {{ id: string, index: number, hidden: boolean, outline: Float32Array, free: () => void }} GameObjectState
* @typedef {{
*  index:                 number,
*  worldTransform:        mat4,
*  worldTransformInverse: mat4,
*  modelMatrix:           mat4,
*  normalMatrix:          mat4,
*  morph?:                MorphState,
*  free: () => void
* }} MeshState
* @typedef {{
*  parent:         Node|null,
*  localTransform: mat4,
*  worldTransform: mat4,
*  mesh?:          MeshState,
*  skin?:          SkinState,
*   morph?:         MorphState,
*  gameObject?:    GameObjectState,
*  free: () => void,
* }} NodeState
*
* @typedef {{ include?: Set<string>, exclude?: Set<string> }} GameObjectFilterOptions
*/
