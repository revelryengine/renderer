import { UBO } from '../renderer/ubo.js';
import { vec3, mat3, mat4, quat } from './gl-matrix.js';

const GL = WebGL2RenderingContext;

class PrimtiveUBO extends UBO {
  static location = 1;

  constructor(context) {
    super(context);
    this.upload();
    this.bind();
  }

  static uniforms = [
    { name: 'u_ModelMatrices', type: GL.FLOAT_MAT4, size: 2000 },
  ];
}

/**
 * Analyzes a scene and calculates new transforms for all nodes. It does this in a non destructive way by
 * keeping results in an internal state.
 */
export class Graph {
  state      = new WeakMap();
  #centroids = new WeakMap();

  constructor(context) {
    this.context = context;
    /**
     * Array of { primitive, node, opaque, depth }
     */
    this.primitives = {
      opaque:       [],
      transmissive: [],
      alpha:        [],
    };

    /**
     * Array of { light, node }
     */
    this.lights = [];

    /**
     * Array of { skin, node }
     */
    this.skins  = [];

    this.counts = {};
  }

  clear() {
    this.primitives.opaque.length       = 0;
    this.primitives.transmissive.length = 0;
    this.primitives.alpha.length        = 0;
    
    this.lights.length = 0;
    this.skins.length  = 0;
  }

  update({ scene }) {
    if(this.scene !== scene) {
      this.clear();
      this.scene = scene;
      for (const node of this.scene.nodes) {
        this.updateNode(node);
      }
    }

    this.updateSkins();
    // this.updateBuffers();

    // this.upload();
    this.sort();
  }

  sort() {
    const byPrimitiveId = (a, b) => a.primitive.$id - b.primitive.$id;
    this.primitives.opaque.sort(byPrimitiveId);
    this.primitives.transmissive.sort(byPrimitiveId);
    this.primitives.alpha.sort(byPrimitiveId);
  }

  /**
   * Caclulates the centroid of a primitive. Useful for alpha sort ordering based on centroid depth from camera.
   * https://github.com/KhronosGroup/glTF-Sample-Viewer/blob/d32ca25dc273c0b0982e29efcea01b45d0c85105/src/gltf_utils.js#L88
   * @param {Primitive} primitive
   */
  calculateCentroid(primitive) {
    let centroid = this.#centroids.get(primitive);
    if(centroid) return centroid;

    const accessor = primitive.attributes.POSITION;
    const positions = accessor.getTypedArray();

    const acc = new Float32Array(3);
    const stride = (accessor.bufferView?.byteStride || 12) / 4;

    if(primitive.indices) {
      const indices = primitive.indices.getTypedArray();

      for(let i = 0; i < indices.length; i++) {
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
      for(let i = 0; i < positions.length; i += 3) {
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

  getAABB(primitive) {
    const { POSITION } = primitive.attributes;
    return { min: POSITION.min, max: POSITION.max };
  }

  /**
   * Returns the current state for the node or initializes it if is not present.
   * @param {Node} node - The node to get the state for
   * @returns {Object} - An object containg the state
   */
  getState(node) {
    let state = this.state.get(node); //weakmap is kind of slow, come back to this
    if(!state) {
      state = {
        localTransform:        mat4.create(),
        worldTransform:        mat4.create(),
        worldTransformInverse: mat4.create(),
        parent: null,
        
      };
      this.state.set(node, state);
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
   * Returns the world transform inverse matrix based on last update.
   * @returns {mat4}
   */
  getWorldTransformInverse(node) {
    return this.getState(node).worldTransformInverse;
  }

  /**
   * Returns the normal matrix based on last update.
   * @returns {mat4}
   */
  getNormalMatrix(node) {
    return this.getState(node).normalMatrix;
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
      parent,
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

    // Update world transform inverse
    mat4.invert(worldTransformInverse, worldTransform);

    if(node.extensions?.KHR_lights_punctual) {
      this.lights = this.lights.filter(l => node != l.node); //Clear any lights from a previous update

      const { light } = node.extensions.KHR_lights_punctual;
      this.lights.push({ light, node, ...light.getUniformStruct(worldTransform) });
    }

    if(mesh) {
      //Clear any primitives from a previous update
      this.primitives.opaque       = this.primitives.opaque.filter(p => node != p.node);
      this.primitives.transmissive = this.primitives.transmissive.filter(p => node != p.node);
      this.primitives.alpha        = this.primitives.alpha.filter(p => node != p.node);

      for(const primitive of mesh.primitives) {
        const aabb = this.getPrimitiveAABB(primitive, worldTransform);
        const p    = { node, primitive, worldTransform, aabb };

        if(!primitive.material) {
          this.primitives.opaque.push(p);
          continue;
        }

        if(primitive.material.alphaMode === 'BLEND' || primitive.material.alphaMode === 'MASK') {
          this.primitives.alpha.push(p);
        } else if(primitive.material.extensions.KHR_materials_transmission) {
          this.primitives.transmissive.push(p);
        } else {
          this.primitives.opaque.push(p);
        } 
      }
    }

    if(skin) {
      this.skins.push({ node, skin });
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
  updateNodes(nodes) {
    const search = [...this.scene.nodes];

    while(search.length) {
      const node = search.shift();
      if(nodes.has(node)) {
        this.updateNode(node);
      } else {
        search.push(...node.children);
      }
    }
  }

  getSkinState(node) {
    return this.state.get(node) || this.state.set(node, {}).get(node);
  }

  updateSkins() {
    for(const { skin, node } of this.skins) {
      const state = this.getSkinState(node);

      state.jointMatrices       = new Float32Array(skin.joints.length * 16);
      state.jointNormalMatrices = new Float32Array(skin.joints.length * 16);

      const jointMatrix       = mat4.create();
      const jointNormalMatrix = mat4.create();

      const { worldTransformInverse } = this.getState(node);

      for (let i = 0; i < skin.joints.length; i++) {
        const jointTransform    = this.getWorldTransform(skin.joints[i]);
        const inverseBindMatrix = skin.inverseBindMatrices.createTypedView(i * 16, 1);

        mat4.mul(jointMatrix, jointTransform, inverseBindMatrix);
        mat4.mul(jointMatrix, worldTransformInverse, jointMatrix);

        mat4.invert(jointNormalMatrix, jointMatrix);
        mat4.transpose(jointNormalMatrix, jointNormalMatrix);

        for (let j = 0; j < 16; j++){
          state.jointMatrices[i * 16 + j]       = jointMatrix[j];
          state.jointNormalMatrices[i * 16 + j] = jointNormalMatrix[j];
        }
      }
    }
  }

  #buffers = new WeakMap();
  updateBuffers() {
    let count = 0, last;

    const process = (primitive, count) => {
      const buffer = this.#buffers.get(primitive) || this.#buffers.set(primitive, new PrimtiveUBO(this.context, count)).get(primitive);
      // if(buffer.count !== count){
      //   buffer = new PrimtiveUBO(this.context, count);
      //   this.#buffers.set(buffer);
      // }
      count = 0;
    }

    for(const { primitive, node } of this.primitives.opaque) {
      if(last === primitive) {
        count++;
      } else {
        if(last) process(last, count);
      }
      last = primitive;
    }
    if(last) process(last, count);
  }

  getJointMatrices(node) {
    return this.getSkinState(node);
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

    for(let i = 0; i < abs.length; i++) {
      abs[i] = Math.abs(abs[i]);
    }

    vec3.transformMat3(extents, extents, abs);

    const min = vec3.sub([], center, extents);
    const max = vec3.add([], center, extents);

    /**
     * split the transform into a translation vector (T) and a 3x3 rotation (M).
      B = zero-volume AABB at T
      for each element (i,j) of M:
        a = M[i][j] * A.min[j]
        b = M[i][j] * A.max[j]
        B.min[i] += a < b ? a : b
        B.max[i] += a < b ? b : a
      return B
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

    const min = [ Infinity, Infinity, Infinity];
    const max = [-Infinity,-Infinity,-Infinity];

    if(node.mesh?.primitives) {
      for(const primitive of node.mesh.primitives) {
        if(primitive.attributes.POSITION) {
          const { min: pMin, max: pMax } = this.getPrimitiveAABB(primitive, nodeTransform);
  
          for (let i = 0; i < 3; i++) {
            min[i] = Math.min(min[i], pMin[i]);
            max[i] = Math.max(max[i], pMax[i]);
          }
        }
      }
    }

    if(node.children) {
      for(const child of node.children){
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

    const min = [ Infinity, Infinity, Infinity];
    const max = [-Infinity,-Infinity,-Infinity];

    for(const node of scene.nodes) {
      if(!node.camera) {
        const { min: nMin, max: nMax } = this.getNodeAABB(node);
        for (let i = 0; i < 3; i++) {
          min[i] = Math.min(min[i], nMin[i]);
          max[i] = Math.max(max[i], nMax[i]);
        }
      }
    }

    return { min, max };
  }
}

export default Graph;
