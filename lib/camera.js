import { NamedGLTFProperty } from './named-gltf-property.js';

/**
 * An orthographic camera containing properties to create an orthographic projection matrix.
 * @typedef {glTFProperty} orthographic
 * @property {Number} xmag - The floating-point horizontal magnification of the view.
 * @property {Number} ymag - The floating-point vertical magnification of the view.
 * @property {Number} zfar - The floating-point distance to the far clipping plane. zfar must be greater than znear.
 * @property {Number} znear - The floating-point distance to the near clipping plane.
 *
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#orthographic
 */

/**
 * A perspective camera containing properties to create a perspective projection matrix.
 * @typedef {glTFProperty} perspective
 * @property {Number} [aspectRatio] - The floating-point aspect ratio of the field of view.
 * @property {Number} yfov - The floating-point vertical field of view in radians.
 * @property {Number} [zfar] - The floating-point distance to the far clipping plane. zfar must be greater than znear.
 * @property {Number} znear - The floating-point distance to the near clipping plane.
 *
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#perspective
 */

/**
 * A camera's projection. A node can reference a camera to apply a transform to place the camera in the scene.
 * @typedef {namedGLTFProperty} camera
 * @property {orthographic} [orthographic] - An orthographic camera containing properties to create an orthographic
 * projection matrix.
 * @property {perspective} [perspective] - A perspective camera containing properties to create a perspective
 * projection matrix.
 * @property {String} type - Specifies if the camera uses a perspective or orthographic projection.
 * interpolation algorithm to define a keyframe graph (but not its target).
 *
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#camera
 */

/**
 * A class wrapper around the glTF camera object.
 */
export class Camera extends NamedGLTFProperty {
  /**
   * Creates an instance of Camera.
   * @param {camera} camera - The properties of the camera.
   * @param {WebGLTF} [root=this] - The root WebGLTF object.
   */
  constructor(camera, root) {
    super(camera, root);

    const { type, perspective, orthographic } = camera;

    /**
     * Specifies if the camera uses a perspective or orthographic projection.
     * interpolation algorithm to define a keyframe graph (but not its target).
     * @type {String}
     */
    this.type = type;

    /**
     * A perspective camera containing properties to create a perspective
     * projection matrix.
     * @type {perspective}
     */
    this.perspective = perspective;

    /**
     * An orthographic camera containing properties to create an orthographic
     * projection matrix.
     * @type {orthographic}
     */
    this.orthographic = orthographic;
  }
}

export default Camera;
