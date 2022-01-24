/**
 * @see https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html#animations
 */

import { quat        } from '../deps/gl-matrix.js';
import { normalizers } from './utils.js';

const q1 = quat.create();
const q2 = quat.create();

const interpolators = {
    STEP: (outputArray, node, path, start, stride) => {
        start *= stride;

        for (let i = 0; i < stride; i++) {
            node[path][i] = outputArray[start + i];
        }
    },
    LINEAR: (outputArray, node, path, start, stride, end, t, normalize) => {
        start *= stride;
        end *= stride;

        if (path === 'rotation') { //slerp
            quat.set(q1,
                outputArray[start],
                outputArray[start + 1],
                outputArray[start + 2],
                outputArray[start + 3],
            );

            quat.set(q2,
                outputArray[end],
                outputArray[end + 1],
                outputArray[end + 2],
                outputArray[end + 3],
            );

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
    CUBICSPLINE: (outputArray, node, path, start, stride, end, t, _normalize, inputArray) => {
        const tDelta = inputArray[end] - inputArray[start];

        start *= stride * 3;
        end *= stride * 3;

        const A = 0;
        const V = 1 * stride;
        const B = 2 * stride;

        const tSq = t ** 2;
        const tCub = t ** 3;

        for (let i = 0; i < stride; ++i) {
            const p0 = outputArray[start + V + i];
            const m0 = tDelta * outputArray[start + B + i];
            const p1 = outputArray[end + V + i];
            const m1 = tDelta * outputArray[start + A + i];
            node[path][i] = ((2 * tCub - 3 * tSq + 1) * p0) + ((tCub - 2 * tSq + t) * m0) + ((-2 * tCub + 3 * tSq) * p1) + ((tCub - tSq) * m1);
        }

        if (path === 'rotation') {
            quat.normalize(node[path], node[path]);
        }
    },
};

/** @todo use a binary search algorithm */
function findNextKeyFrame(input, t) {
    return input.findIndex(v => v > t);
}

const nodeUpdates = new Set();
export class Animator {
    constructor(graph, animations = [], loop = true) {
        this.graph = graph;
        this.time  = 0;
        this.loop  = loop;
        this.animations = animations;
    }
    update(delta, names = []) {
        this.time += delta / 1000;

        for (const animation of this.animations) {
            if (names.length && names.indexOf(animation.name) === -1) continue;

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
                    const last = outputArray.length - stride;
                    for (let i = 0; i < stride; i++) {
                        node[path][i] = normalize(outputArray[last + i + (interpolation === 'CUBICSPLINE' ? stride : 0)]);
                    }
                } else {
                    const next = findNextKeyFrame(inputArray, time);
                    const startTime = inputArray[next - 1];
                    const endTime = inputArray[next];

                    const t = (time - startTime) / (endTime - startTime);

                    const start = (next - 1);
                    const end = next;
                    interp(outputArray, node, path, start, stride, end, t, normalize, inputArray);
                }
                nodeUpdates.add(node);
            }
        }

        this.graph.updateNodes(nodeUpdates);

        nodeUpdates.clear();
    }
}

export default Animator;
