/**
 * @see https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#animations
 */

const GL = WebGLRenderingContext;
const normalizers = {
  [GL.FLOAT]: f => f,
  [GL.BYTE]: c => Math.max(c / 127.0, -1.0),
  [GL.UNSIGNED_BYTE]: c => c / 255.0,
  [GL.SHORT]: c => Math.max(c / 32767.0, -1.0),
  [GL.UNSIGNED_SHORT]: c => c / 65535.0,
};

const interpolators = {
  LINEAR: (path, inIndex, outIndex, t, stride, normalize, outputArray) => {
    for (let i = 0; i < stride; i++) {
      const a = normalize(outputArray[inIndex + i]);
      const b = normalize(outputArray[outIndex + i]);
      path[i] = a + (t * (b - a));
    }
  },
  STEP: () => {},
  CUBICSPLINE: () => {},
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

        const time = this.loop ? this.time % animation.duration : this.time;

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
            node[path][i] = normalize(outputArray[i]);
          }
        } else if (time >= input.max[0]) {
          const last = (outputArray.length - 1) * stride;
          for (let i = 0; i < stride; i++) {
            node[path][i] = normalize(outputArray[last + i]);
          }
        } else {
          const next = findNextKeyFrame(inputArray, time);

          const startTime = inputArray[next - 1];
          const endTime = inputArray[next];

          const t = (time - startTime) / (endTime - startTime);

          const inIndex = (next - 1) * stride;
          const outIndex = next * stride;

          interp(node[path], inIndex, outIndex, t, stride, normalize, outputArray);
        }
      }
    }
  }
}

export default Animator;
