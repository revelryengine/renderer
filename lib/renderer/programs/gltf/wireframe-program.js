import { SolidProgram } from './solid-program.js';

export class WireframeProgram extends SolidProgram { 
    #wireframes = new WeakMap();

    drawInstances(primitive, instanceCount) {
        const { context: gl } = this;    
        const { indices, mode } = primitive;
    
        if (indices && mode === gl.TRIANGLES) { /* indices is required for creating a wireframe object */
            const { count, componentType } = indices;
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.getWireframeBuffer(primitive));
            gl.drawElementsInstanced(gl.LINES, count * 2, componentType, 0, instanceCount);
        }
    }

    getWireframeBuffer(primitive) {
        return this.#wireframes.get(primitive) || this.#wireframes.set(primitive, this.createWireframeBuffer(primitive)).get(primitive);
    }

    createWireframeBuffer(primitive) {
        const { context: gl } = this;
        const { indices } = primitive;
        const { count } = indices;

        const buffer     = gl.createBuffer();
        const typedArray = indices.getTypedArray();
        const wireframe  = new typedArray.constructor(count * 2);

        for(let i = 0; i < typedArray.length; i += 3) {
            wireframe[(i * 2) + 0] = typedArray[i];
            wireframe[(i * 2) + 1] = typedArray[i + 1];
            wireframe[(i * 2) + 2] = typedArray[i + 1];
            wireframe[(i * 2) + 3] = typedArray[i + 2];
            wireframe[(i * 2) + 4] = typedArray[i + 2];
            wireframe[(i * 2) + 5] = typedArray[i];
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, wireframe, gl.STATIC_DRAW);

        return buffer;
    }
}

export default WireframeProgram;