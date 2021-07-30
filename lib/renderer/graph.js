import { mat4, vec3, vec4, quat } from '../utils/gl-matrix.js';

/**
 * A unit cube in WebGL coordinates
 */
const FRUSTUM_CUBE = [
  vec4.fromValues(-1, -1, -1, 1),
  vec4.fromValues(-1,  1, -1, 1),
  vec4.fromValues( 1,  1, -1, 1),
  vec4.fromValues( 1, -1, -1, 1),
  vec4.fromValues(-1, -1,  1, 1),
  vec4.fromValues(-1,  1,  1, 1),
  vec4.fromValues( 1,  1,  1, 1),
  vec4.fromValues( 1, -1,  1, 1),
]

/**
 * Analyzes a scene and calculates new transforms for all nodes. It does this in a non destructive way by
 * keeping results in an internal state.
 */
export class Graph {
  #state = new WeakMap();
  #centroids = new WeakMap();

  constructor(settings) {
    /**
     * Array of { primitive, node }
     */
    this.primitives = [];

    /**
     * Array of { light, node, struct }
     */
    this.lights = [];

    this.viewInfo = {
      viewport: { x: 0, y: 0, width: 0, height: 0 },

      viewMatrix:           mat4.create(),
      cameraPosition:       vec3.create(),
      projectionMatrix:     mat4.create(),
      viewProjectionMatrix: mat4.create(),
      invProjectionMatrix:  mat4.create(),

      frustum: {
        corners: [...new Array(8)].map(() => vec4.create()),
        center: vec3.create(),
      },
    }

    this.settings = settings;
  }

  analyze({ scene, cameraNode, viewport, environment }) {
    this.environment = environment; //Until KHR_lights_environment is ratified the environment should be passed in from the renderer.

    this.scene = scene;
    this.cameraNode = cameraNode;

    this.lights.length = 0;
    this.primitives.length = 0;

    this.update(cameraNode); //camera may be external to scene so we need to update it explicitly
    
    for (const node of scene.nodes) {
      this.update(node);
    }

    this.updateViewInfo(cameraNode, viewport);

    this.lights = this.lights.map(({ light, node }) => {
      return light.getUniformStruct(this.getWorldTransform(node));
    });

    this.primitives.sort((a, b) => {
        return (!!a.primitive.material?.extensions.KHR_materials_transmission - !!b.primitive.material?.extensions.KHR_materials_transmission) 
                || (b.opaque - a.opaque) || (b.depth - a.depth);
    });
  }

  updateViewInfo(cameraNode, viewport) {
    const { viewInfo } = this;

    const { x = 0, y = 0, width, height } = viewport;
    viewInfo.viewport = { x, y, width, height };

    const { cameraPosition, viewMatrix, projectionMatrix, viewProjectionMatrix, invProjectionMatrix } = viewInfo;

    const cameraTransform = this.getWorldTransform(cameraNode);

    mat4.getTranslation(cameraPosition, cameraTransform);
    mat4.invert(viewMatrix, cameraTransform);

    mat4.identity(projectionMatrix);

    cameraNode.camera.getProjectionMatrix(projectionMatrix, viewport.width, viewport.height);

    mat4.multiply(viewProjectionMatrix, projectionMatrix, viewMatrix);
    mat4.invert(invProjectionMatrix, projectionMatrix);

    /**
     * Collect world space frustum corners and center. This will be useful for things like shadow maps
     */
    const { corners, center } = viewInfo.frustum;

    vec3.zero(center);
    for (let i = 0; i < 8; i++) { 
      vec4.transformMat4(corners[i], FRUSTUM_CUBE[i], invProjectionMatrix);
      vec4.scale(corners[i], corners[i], 1 / corners[i][3]);
      vec4.transformMat4(corners[i], corners[i], viewMatrix);

      vec3.add(center, center, corners[i]);
    }
    vec3.scale(center, center, 1/8);
  }

  /**
   * Caclulates the centroid of a primitive. Useful for alpha sort ordering based on centroid depth from camera.
   * https://github.com/KhronosGroup/glTF-Sample-Viewer/blob/d32ca25dc273c0b0982e29efcea01b45d0c85105/src/gltf_utils.js#L88
   * @param {Primitive} primitive
   */
  calculateCentroid(primitive) {
    if(this.#centroids.get(primitive)) return;

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

      const centroid = new Float32Array([
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

      const centroid = new Float32Array([
        acc[0] / positionVectors,
        acc[1] / positionVectors,
        acc[2] / positionVectors,
      ]);

      this.#centroids.set(primitive, centroid);
    }
  }

  /**
   * Returns the current state for the node or initializes it if is not present.
   * @param {Node} node - The node to get the state for
   * @returns {Object} - An object containg the state
   */
  getState(node) {
    let state = this.#state.get(node);
    if(!state) {
      state = {
        localTransform: mat4.create(),
        worldTransform: mat4.create(),
        worldTransformInverse: mat4.create(),
        normalMatrix: mat4.create(),
      };

      if(node.skin) {
        state.jointMatrices = new Float32Array(node.skin.joints.length * 16);
        state.jointNormalMatrices = new Float32Array(node.skin.joints.length * 16);
      }
      this.#state.set(node, state);
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
   * Returns the joint matrix based on last update.
   * @returns {mat4}
   */
  getJointMatrices(node) {
    return this.getState(node).jointMatrices;
  }

  /**
   * Returns the joint normal matrix based on last update.
   * @returns {mat4}
   */
  getJointNormalMatrices(node) {
    return this.getState(node).jointNormalMatrices;
  }

  /**
   * Updates the node's transform information relative to the parentTransform.
   * @param {Node} node - The node to update
   * @param {mat4} parentTransform
   */
  update(node, parentTransform = mat4.create()) {
    const { matrix, skin, mesh, extensions } = node;
    const {
      localTransform, worldTransform, worldTransformInverse, normalMatrix, jointMatrices, jointNormalMatrices
    } = this.getState(node);

    // Update local transform
    if (matrix) {
      mat4.copy(localTransform, matrix);
    } else {
      const { rotation = [0.0, 0.0, 0.0, 1.0], translation = [0.0, 0.0, 0.0], scale = [1.0, 1.0, 1.0] } = node;
      const q = quat.create();
      quat.normalize(q, rotation);
      mat4.fromRotationTranslationScale(localTransform, q, translation, scale);
    }

    // Update world transform
    mat4.copy(worldTransform, localTransform);
    mat4.mul(worldTransform, parentTransform, localTransform);

    // Update world transform inverse
    mat4.invert(worldTransformInverse, worldTransform);

    // Update normal matrix
    mat4.transpose(normalMatrix, worldTransformInverse);

    // Update joint matrix and joint normal matrix
    if(skin) {
      for (let i = 0; i < skin.joints.length; i++) {
        const jointTransform = this.getWorldTransform(skin.joints[i]);

        const jointMatrix = mat4.create();
        const inverseBindMatrix = skin.inverseBindMatrices.createTypedView(i * 16, 1);

        mat4.mul(jointMatrix, jointTransform, inverseBindMatrix);
        mat4.mul(jointMatrix, worldTransformInverse, jointMatrix);

        const jointNormalMatrix = mat4.create();
        mat4.invert(jointNormalMatrix, jointMatrix);
        mat4.transpose(jointNormalMatrix, jointNormalMatrix);

        for (let j = 0; j < 16; j++){
          jointMatrices[i * 16 + j] = jointMatrix[j];
          jointNormalMatrices[i * 16 + j] = jointNormalMatrix[j];
        }
      }
    }

    if(mesh) {
      const modelView = mat4.create();
      mat4.multiply(modelView, this.viewInfo.viewMatrix, worldTransform);

      for (const primitive of mesh.primitives) {
        this.calculateCentroid(primitive);

        const pos = vec3.transformMat4(vec3.create(), vec3.clone(this.#centroids.get(primitive)), modelView);
        const opaque = primitive.material?.alphaMode === 'OPAQUE';

        this.primitives.push({ primitive, node, opaque, depth: -pos[2] });
      }
    }

    if(extensions && extensions.KHR_lights_punctual) {
      const { light } = extensions.KHR_lights_punctual;
      this.lights.push({ light, node });
    }

    for (const n of node.children) {
      this.update(n, worldTransform);
    }
  }
}

export default Graph;
