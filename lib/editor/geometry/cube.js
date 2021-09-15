import { Geometry } from './geometry.js';
import { vec3  } from '../../utils/gl-matrix.js';

export class CubeGeometry extends Geometry {
    createVertices() {
        this.vertices = [
            // front face
            [-1,-1, 1],
            [ 1,-1, 1],
            [ 1, 1, 1],
            [-1, 1, 1],

            // back face
            [-1,-1,-1],
            [-1, 1,-1],
            [ 1, 1,-1],
            [ 1,-1,-1],

            // top face
            [-1, 1,-1],
            [-1, 1, 1],
            [ 1, 1, 1],
            [ 1, 1,-1],

            // bottom face
            [-1,-1,-1],
            [ 1,-1,-1],
            [ 1,-1, 1],
            [-1,-1, 1],

            // right face
            [ 1,-1,-1],
            [ 1, 1,-1],
            [ 1, 1, 1],
            [ 1,-1, 1],

            // left face
            [-1,-1,-1],
            [-1,-1, 1],
            [-1, 1, 1],
            [-1, 1,-1],
        ].map(v => vec3.scale([], v, this.params.size / 2));
    }

    createIndices() {
        this.indices = [
            0,  1,  2,      0,  2,  3,    // front
            4,  5,  6,      4,  6,  7,    // back
            8,  9,  10,     8,  10, 11,   // top
            12, 13, 14,     12, 14, 15,   // bottom
            16, 17, 18,     16, 18, 19,   // right
            20, 21, 22,     20, 22, 23,   // left
        ];
    }
}

export default CubeGeometry;