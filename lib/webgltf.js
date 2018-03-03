import { GLTFProperty    } from './gltf-property.js';

import { Accessor   } from './accessor.js';
import { Animation  } from './animation.js';
import { Asset      } from './asset.js';
import { Buffer     } from './buffer.js';
import { BufferView } from './buffer-view.js';
import { Camera     } from './camera.js';
import { Image      } from './image.js';
import { Material   } from './material.js';
import { Mesh       } from './mesh.js';
import { Node       } from './node.js';
import { Sampler    } from './sampler.js';
import { Scene      } from './scene.js';
import { Skin       } from './skin.js';
import { Texture    } from './texture.js';

const SUPPORTED_VERSION = { major: 2, minor: 0 };

function isSupported(metadata) {
  const { version, minVersion } = metadata;
  const [major, minor] = (minVersion || version).split('.').map(v => Number(v));

  if (major !== SUPPORTED_VERSION.major) {
    return false;
  } else if (minVersion && (minor > SUPPORTED_VERSION.minor)) {
    return false;
  }
  return true;
}

/**
 * The root object for a glTF asset.
 * @typedef {glTFProperty} glTF
 * @property {String[]} [extensionsUsed] - Names of glTF extensions used somewhere in this asset.
 * @property {String[]} [extensionsRequired] - Names of glTF extensions required to properly load this asset.
 * @property {accessor[]} [accessors] - An array of accessors.
 * @property {animation[]} [animations] - An array of keyframe animations.
 * @property {asset} asset - Metadata about the glTF asset.
 * @property {buffer[]} [buffers] - An array of buffers.
 * @property {bufferView[]} [bufferViews] - An array of bufferViews.
 * @property {camera[]} [cameras] - An array of cameras.
 * @property {image[]} [images] - An array of images.
 * @property {material[]} [materials] - An array of materials.
 * @property {mesh[]} [meshes] - An array of meshes.
 * @property {node[]} [nodes] - An array of nodes.
 * @property {sampler[]} [samplers] - An array of samplers.
 * @property {Number} [scene] - The index of the default scene.
 * @property {scene[]} [scenes] - An array of scenes.
 * @property {skin[]} [skins] - An array of skins.
 * @property {texture[]} [textures] - An array of textures.
 *
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#gltf
 * @todo Automate generation of typedefs from spec
 */

/**
 * A class wrapper for a root glTF object. All index references are dereferenced during construction.
 */
export class WebGLTF extends GLTFProperty {
  /**
   * Creats an instance of WebGLTF
   * @param {glTF} [glTF={ asset: { version: '2.0', generator: 'WebGLTF Runtime Generation' } }] - The glTF root Object
   * @param {string|URL} [uri=window.location.href] - The URI of the glTF object. Relative URIs will be based on this.
   */
  constructor(glTF = { asset: { version: '2.0', generator: 'WebGLTF Runtime Generation' } }, uri = window.location.href) {
    if (!isSupported(glTF.asset)) {
      throw new Error(`Unsupported glTF version ${glTF.asset.minVersion || glTF.asset.version}`);
    }
    super(glTF);

    const {
      extensionsUsed = [], extensionsRequired = [], accessors = [], animations = [],
      asset, buffers = [], bufferViews = [], cameras = [], images = [], materials = [], meshes = [],
      nodes = [], samplers = [], scene, scenes = [], skins = [], textures = [],
    } = glTF;

    /**
     * Metadata about the glTF asset.
     * @type {Asset}
     */
    this.asset = new Asset(asset, this);

    /**
     * Names of glTF extensions used somewhere in this asset.
     * @type {String[]}
     */
    this.extensionsUsed = extensionsUsed;

    /**
     * Names of glTF extensions required to properly load this asset.
     * @type {String[]}
     */
    this.extensionsRequired = extensionsRequired;

    /**
     * An array of Buffers.
     * @type {Buffer[]}
     */
    this.buffers = buffers.map(bufferObj => new Buffer(bufferObj, this));

    /**
     * An array of BufferViews.
     * @type {BufferView[]}
     */
    this.bufferViews = bufferViews.map(bufferViewObj => new BufferView(bufferViewObj, this));

    /**
     * An array of Accessors.
     * @type {Accessor[]}
     */
    this.accessors = accessors.map(accessorObj => new Accessor(accessorObj, this));

    /**
     * An array of Images.
     * @type {Image[]}
     */
    this.images = images.map(imageObj => new Image(imageObj, this));

    /**
     * An array of Samplers.
     * @type {Sampler[]}
     */
    this.samplers = samplers.map(samplerObj => new Sampler(samplerObj, this));

    /**
     * An array of Textures.
     * @type {Texture[]}
     */
    this.textures = textures.map(textureObj => new Texture(textureObj, this));

    /**
     * An array of Materials.
     * @type {Material[]}
     */
    this.materials = materials.map(materialObj => new Material(materialObj, this));

    /**
     * An array of skins.
     * @type {Skin[]}
     */
    this.skins = skins.map(skinObj => new Skin(skinObj, this));

    /**
     * An array of Cameras.
     * @type {Camera[]}
     */
    this.cameras = cameras.map(cameraObj => new Camera(cameraObj, this));

    /**
     * An array of meshes.
     * @type {Mesh[]}
     */
    this.meshes = meshes.map(meshObj => new Mesh(meshObj, this));

    /**
     * An array of nodes.
     * @type {Node[]}
     */
    this.nodes = nodes.map(nodeObj => new Node(nodeObj, this));

    /**
     * An array of scenes.
     * @type {Scene[]}
     */
    this.scenes = scenes.map(sceneObj => new Scene(sceneObj, this));

    /**
     * The default scene.
     * @type {Scene}
     */
    this.scene = this.scenes[scene];

    /**
     * An array of keyframe Animations.
     * @type {Animation[]}
     */
    this.animations = animations.map(animationObj => new Animation(animationObj, this));

    Object.defineProperty(this, '$uri', { value: uri });

    this.dereference();
  }

  /**
   * Dereference glTF index properties.
   */
  dereference() {
    const props = [
      'bufferViews', 'accessors', 'images', 'textures',
      'materials', 'skins', 'meshes', 'nodes', 'scenes', 'animations',
    ];
    for (const prop of props) {
      for (const obj of this[prop]) {
        obj.dereference();
      }
    }

    if (this.scene !== undefined) this.scene = this.scenes[this.scene];
  }

  /**
   * Rereference glTF index properties.
   */
  rereference() {
    const props = [
      'bufferViews', 'accessors', 'images', 'textures',
      'materials', 'skins', 'meshes', 'nodes', 'scenes', 'animations',
    ];
    for (const prop of props) {
      for (const obj of this[prop]) {
        obj.rereference();
      }
    }

    if (this.scene !== undefined) this.scene = this.scenes.indexOf(this.scene);
  }

  /**
   * Fetches a glTF file from a URI, then fetches all binary data, and returns a new WebGLTF instance.
   * @param {string|URL} uri - The URI of the glTF file to be loaded.
   */
  static async load(uri) {
    const gltf = new WebGLTF(await fetch(uri).then(res => res.json()), uri);
    return gltf.load().then(() => gltf);
  }

  /**
   * Fetches all binary data into memory.
   */
  async load() {
    return Promise.all([
      ...this.images.map(image => image.load()),
      ...this.buffers.map(buffers => buffers.load()),
    ]);
  }

  /**
   * Returns a URI relative to the root WebGLTF object
   * @param {string|URL} uri - The URI to get relative to the root WebGLTF object
   */
  getRelativeURI(uri) {
    return new URL(uri, this.$uri);
  }

  /**
   * Creates a new scene and adds it to the glTF object
   * @param {String} [name] - The name of the scene.
   * @returns {scene}
   */
  createScene(name) {
    const scene = new Scene({ name, nodes: [] }, this);
    this.scenes.push(scene);
    return scene;
  }

  /**
   * Creates a new camera and adds it to the glTF object. A camera in glTF is essentially a Node with a reference to
   * optic properties which is also called "camera". Therefore the position matrix is required to create a camera and
   * the returned value is the node, not the camera optics object.
   * @param {String} [type='perspective'] - The type of camera to create. The available types are 'perspective' and 'orthographic'
   * @param {perspective|orthographic} [optics={ yfov: 45 * (Math.PI / 180), znear: 0.01 }] - The properties of the camera optics.
   * @param {Object} position - The position of the node.
   * @param {Number[]} [position.matrix=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]] - A floating-point 4x4 transformation matrix
   * stored in column-major order.
   * @param {Number[]} [position.rotation=[0,0,0,1]] - The node's unit quaternion rotation in the order (x, y, z, w),
   * where w is the scalar.
   * @param {Number[]} [position.scale=[1,1,1]] - The node's non-uniform scale, given as the scaling factors along the
   * x, y, and z axes.
   * @param {Number[]} [position.translation=[0,0,0]] - The node's translation along the x, y, and z axes.
   */
  createCamera({ type = 'perspective', optics = { yfov: 45 * (Math.PI / 180), znear: 0.001 }, position = {} }) {
    const camera = new Camera({ type, [type]: optics }, this);
    this.cameras.push(camera);
    const node = new Node({ ...position, camera }, this);
    this.nodes.push(node);
    return node;
  }
}

export { Renderer } from './renderer/renderer.js';
export { Node, Camera, Scene };

export default WebGLTF;
