import { Geometry } from './geometry.js';
import { vec3  } from '../../utils/gl-matrix.js';

export class PlaneGeometry extends Geometry {
    createVertices() {
        this.vertices = [
            [-1, 0,-1],
            [-1, 0, 1],
            [ 1, 0, 1],
            [ 1, 0,-1],
        ].map(v => vec3.scale([], v, this.params.size / 2));
    }

    createIndices() {
        this.indices = [
            0, 1, 2,     0, 2, 3
        ];
    }
}

export default PlaneGeometry;