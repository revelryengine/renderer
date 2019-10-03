import { NamedGLTFProperty } from './gltf-property.js';
import { mat4 } from '../vendor/gl-matrix.js';

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
   */
  constructor(camera) {
    super(camera);

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

  /**
   * Returns a the projection matrix for this camera
   * @param {Number} [viewportWidth=1] - The viewport width. Will be used if aspectRatio is not defined.
   * @param {Number} [viewportHeight=1] - The viewport height. Will be used if aspectRatio is not defined.
   * @returns {Float32Array}
   */
  getProjectionMatrix(viewportWidth = 1, viewportHeight = 1) {
    const matrix = mat4.create();
    if (this.type === 'perspective') {
      const { aspectRatio = viewportWidth / viewportHeight, yfov, znear, zfar } = this.perspective;
      matrix[0] = 1 / (aspectRatio * Math.tan(0.5 * yfov));
      matrix[5] = 1 / Math.tan(0.5 * yfov);
      matrix[10] = zfar ? ((zfar + znear) / (znear - zfar)) : -1;
      matrix[11] = -1;
      matrix[14] = zfar ? ((2 * zfar * znear) / (znear - zfar)) : -2 * znear;
      matrix[15] = 0;
    } else {
      const { xmag, ymag, znear, zfar } = this.orthographic;
      matrix[0] = 1 / xmag;
      matrix[5] = 1 / ymag;
      matrix[10] = 2 / (znear - zfar);
      matrix[14] = (zfar + znear) / (znear - zfar);
    }
    return matrix;
  }
}

export default Camera;
