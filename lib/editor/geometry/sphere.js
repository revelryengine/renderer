import { Geometry } from './geometry.js';

export class SphereGeometry extends Geometry {
    createVertices() {
        this.vertices = [];
    }

    createIndices() {
        this.indices = [];
    }
}

export default SphereGeometry;