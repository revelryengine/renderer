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
  LINEAR: (a, b, t) => a + (t * (b - a)),
};

/** @todo use a binary search algorithm */
function findNextKeyFrame(input, t) {
  return input.findIndex(v => v > t);
}

const typedArrays = new WeakMap();

export class Animator {
  constructor(webgltf, loop = true) {
    this.time = 0;
    this.loop = loop;
    this.webgltf = webgltf;
  }
  update(delta) {
    this.time += delta / 1000;

    const { animations = [] } = this.webgltf;
    for (const animation of animations) {
      for (const channel of animation.channels) {
        const { target: { node, path }, sampler: { input, output, interpolation } } = channel;

        const inputArray = typedArrays.get(input) || typedArrays.set(input, input.createTypedView()).get(input);
        const outputArray = typedArrays.get(output) || typedArrays.set(output, output.createTypedView()).get(output);

        const time = this.loop ? this.time % input.max[0] : this.time;

        const next = findNextKeyFrame(inputArray, time);

        if (next !== -1) {
          const startTime = inputArray[next - 1];
          const endTime = inputArray[next];

          const interp = interpolators[interpolation];
          const normal = normalizers[output.componentType];

          const t = (time - startTime) / (endTime - startTime);

          if (!node[path]) node[path] = [];

          const numberOfComponents = path === 'weights' ? node.numberOfMorphTargets : output.numberOfComponents;

          const inIndex = (next - 1) * numberOfComponents;
          const outIndex = next * numberOfComponents;


          for (let i = 0; i < numberOfComponents; i++) {
            node[path][i] = interp(normal(outputArray[inIndex + i]), normal(outputArray[outIndex + i]), t);
          }
        }
      }
    }
  }
}

export default Animator;
