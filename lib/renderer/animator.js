/**
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#animations
 */

import { glMatrix } from '../webgltf.js';

const { quat } = glMatrix;

const GL = WebGLRenderingContext;
const normalizers = {
  [GL.FLOAT]: f => f,
  [GL.BYTE]: c => Math.max(c / 127.0, -1.0),
  [GL.UNSIGNED_BYTE]: c => c / 255.0,
  [GL.SHORT]: c => Math.max(c / 32767.0, -1.0),
  [GL.UNSIGNED_SHORT]: c => c / 65535.0,
};

const interpolators = {
  STEP: (node, path, start, end, t, stride, normalize, inputArray, outputArray) => {
    start *= stride;

    for (let i = 0; i < stride; i++) {
      node[path][i] = outputArray[start + i];
    }
  },
  LINEAR: (node, path, start, end, t, stride, normalize, inputArray, outputArray) => {
    start *= stride;
    end *= stride;

    if(path === 'rotation') { //slerp
      const q1 = quat.fromValues(
        outputArray[start],
        outputArray[start + 1],
        outputArray[start + 2],
        outputArray[start + 3],
      );

      const q2 = quat.fromValues(
        outputArray[end],
        outputArray[end + 1],
        outputArray[end + 2],
        outputArray[end + 3],
      );

      quat.normalize(q1, q1);
      quat.normalize(q2, q2);

      quat.slerp(node[path], q1, q2, t);
      quat.normalize(node[path], node[path]);
    } else {
      for (let i = 0; i < stride; i++) {
        const a = normalize(outputArray[start + i]);
        const b = normalize(outputArray[end + i]);
        node[path][i] = a + (t * (b - a));
      }
    }
  },
  /**
   * @see https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#appendix-c-spline-interpolation
   */
  CUBICSPLINE: (node, path, start, end, t, stride, normalize, inputArray, outputArray) => {
    const tDelta = inputArray[end] - inputArray[start];

    start *= stride * 3;
    end *= stride * 3;

    const A = 0;
    const V = 1 * stride;
    const B = 2 * stride;

    const tSq = t ** 2;
    const tCub = t ** 3;

    for(let i = 0; i < stride; ++i) {
      const p0 = outputArray[start + V + i];
      const m0 = tDelta * outputArray[start + B + i];
      const p1 = outputArray[end + V + i];
      const m1 = tDelta * outputArray[start + A + i];
      node[path][i] = ((2*tCub - 3*tSq + 1) * p0) + ((tCub - 2*tSq + t) * m0) + ((-2*tCub + 3*tSq) * p1) + ((tCub - tSq) * m1);
    }

    if(path === 'rotation') {
      quat.normalize(node[path], node[path]);
    }
  },
};

/** @todo use a binary search algorithm */
function findNextKeyFrame(input, t) {
  return input.findIndex(v => v > t);
}

export class Animator {
  constructor(animations = [], loop = true) {
    this.time = 0;
    this.loop = loop;
    this.animations = animations;
  }
  update(delta) {
    this.time += delta / 1000;

    for (const animation of this.animations) {
      for (const channel of animation.channels) {
        const { target: { node, path }, sampler: { input, output, interpolation } } = channel;

        const inputArray = input.getTypedArray();
        const outputArray = output.getTypedArray();

        const time = this.loop ? this.time % animation.getDuration() : this.time;

        if (!node[path]) node[path] = [];

        const stride = path === 'weights' ? node.getNumberOfMorphTargets() : output.getNumberOfComponents();
        const interp = interpolators[interpolation];
        const normalize = normalizers[output.componentType];

        /**
         * Clamp keyframes to start and end if outside time range
         * @see https://github.com/KhronosGroup/glTF/issues/1179
         */
        if (time <= input.min[0]) {
          for (let i = 0; i < stride; i++) {
            node[path][i] = normalize(outputArray[i + (interpolation === 'CUBICSPLINE' ? stride : 0)]);
          }
        } else if (time >= input.max[0]) {
          const last = (outputArray.length - 1) * stride;
          for (let i = 0  ; i < stride; i++) {
            node[path][i] = normalize(outputArray[last + i + (interpolation === 'CUBICSPLINE' ? stride : 0)]);
          }
        } else {
          const next = findNextKeyFrame(inputArray, time);

          const startTime = inputArray[next - 1];
          const endTime = inputArray[next];

          const t = (time - startTime) / (endTime - startTime);

          const start = (next - 1);
          const end = next;

          interp(node, path, start, end, t, stride, normalize, inputArray, outputArray);
        }
      }
    }
  }
}

export default Animator;
