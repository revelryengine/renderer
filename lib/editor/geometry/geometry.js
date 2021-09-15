import { Buffer     } from '../../buffer.js';
import { BufferView } from '../../buffer-view.js';
import { Accessor   } from '../../accessor.js';

const GL = WebGL2RenderingContext;

export class Geometry {
    constructor(params = {}) {
        this.params = params;

        this.createVertices();
        this.createIndices();

        const { vertices, indices } = this;
        
        const posBytes = (vertices.length * 4 * 3);
        const indBytes = (indices.length * 4);
        
        this.buffer = new Buffer({ byteLength: posBytes + indBytes });

        this.bufferViews = {
            POSITION: new BufferView({ buffer: this.buffer, byteLength: posBytes, target: GL.ARRAY_BUFFER }),
            indices:  new BufferView({ buffer: this.buffer, byteLength: indBytes, byteOffset: posBytes, target: GL.ELEMENT_ARRAY_BUFFER }),
        }
        const posMinMax = Geometry.getMinMaxVertices(vertices);
        const indMinMax = Geometry.getMinMaxIndices(indices);

        this.accessors = {
            POSITION: new Accessor({ type: 'VEC3', componentType: GL.FLOAT, bufferView: this.bufferViews.POSITION, count: vertices.length, ...posMinMax }),
            indices:  new Accessor({ type: 'SCALAR', componentType: GL.UNSIGNED_INT, bufferView: this.bufferViews.indices, count: indices.length, ...indMinMax }),
        }

        this.accessors.POSITION.initBufferData();
        this.accessors.indices.initBufferData();

        const posTypedArray = this.accessors.POSITION.getTypedArray();

        
    
        for(let i = 0; i < vertices.length; i++) {
            posTypedArray[(i * 3) + 0] = vertices[i][0];
            posTypedArray[(i * 3) + 1] = vertices[i][1];
            posTypedArray[(i * 3) + 2] = vertices[i][2];


        }

        const indTypedArray = this.accessors.indices.getTypedArray();

        for(let i = 0; i < indices.length; i++) {
            indTypedArray[i] = indices[i];
        }
    }

    createVertices() {
        this.vertices = [];
    }

    getIndices() {
        this.indices = [];
    }

    static getMinMaxVertices(vertices) {
        const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];

        for(const vert of vertices) {
            min[0] = Math.min(min[0], vert[0]);
            min[1] = Math.min(min[1], vert[1]);
            min[2] = Math.min(min[2], vert[2]);

            max[0] = Math.max(max[0], vert[0]);
            max[1] = Math.max(max[1], vert[1]);
            max[2] = Math.max(max[2], vert[2]);
        }

        return { min, max };
    }

    static getMinMaxIndices(indices) {
        let min = Infinity;
        let max = -Infinity;
        for(const index of indices){
            min = Math.min(min, index);
            max = Math.max(max, index);
        }
        return { min, max };
    }
}

export default Geometry;