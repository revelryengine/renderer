const GL = WebGL2RenderingContext;

export class RenderNode {
    #program;

    #width  = 0;
    #height = 0;

    scaleFactor = 1;

    square = false;

    output = {};

    capabilities = [];

    constructor(pipeline) {
        this.pipeline  = pipeline;
    }

    get width () {
        return this.#width;
    }

    get height () {
        return this.#height;
    }

    resize({ width, height }) {
        const { scaleFactor, square } = this;

        width  *= scaleFactor;
        height *= scaleFactor;

        if(square) {
            const min = Math.min(width, height);
            width  = min;
            height = min;
        }

        this.#width  = width;
        this.#height = height;

        this.fbo?.setup({ width, height });
    }

    enableCapabilities() {
        const { context: gl } = this.pipeline;
        for(const cap of this.capabilities) {
            gl.enable(cap);
        }
    }

    disableCapabilities() {
        const { context: gl } = this.pipeline;
        for(const cap of this.capabilities) {
            gl.disable(cap);
        }
    }

    clear() {
        const { context: gl } = this.pipeline;
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    start() {
        const { context: gl } = this.pipeline;
        
        this.fbo.bindFramebuffer();
        gl.viewport(0, 0, this.width, this.height);

        this.clear();
        this.enableCapabilities();
    }

    render({ graph, frustum, input = {} }) {
        const program = this.getProgram({ graph });
        program.run({ graph, frustum, input, output: this.output });
    }

    finish() {
        this.fbo.resolve?.();
        const { attachments } = this.fbo;
        for(const texture of [...attachments.colors, attachments.depth, attachments.stencil] ) { 
            if(!texture) continue;
            if(this.output[texture.name] && this.output[texture.name].type === 'texture') {
                const { glTexture, width, height } = texture;
                Object.assign(this.output[texture.name], { glTexture, width, height });
            }
        }
        this.disableCapabilities();
        return this.output;
    }

    run({ graph, frustum, input = {} }) {
        this.start({ graph, frustum, input })
        this.render({ graph, frustum, input });
        return this.finish({ graph, frustum, input });
    }

    createProgram({ graph }) {
        return new (this.program)(this.pipeline.context, { graph, ...this });
    }
    
    getProgram({ graph }) {
        return this.#program || (this.#program = this.createProgram({ graph }));
    }

    reset() {
        this.#program = null;
        this.fbo?.reset();
    }
}

/**
 * A Geometry node will run a program for each primtive
 */
export class GeometryNode extends RenderNode {
    #programs = new WeakMap();

    capabilities = [GL.DEPTH_TEST];
    
    render({ graph, frustum, input = {} }) {
        let lastPrimitive = null, program = null;
        for(const { primitive, node } of frustum.iteratePrimitives({ transmissive: !this.opaque, alpha: !this.opaque })) {
            if(node.skin || node.mesh.weights) {
                const meshedProgram = this.getProgram({ primitive, node, graph });
                meshedProgram.runSingle({ graph, primitive, node, frustum, input });
            } else {
                if(lastPrimitive !== primitive) {
                    program?.run();
                    program = this.getProgram({ primitive, node, graph });
                    program.use();
                    program.update({ graph, primitive, node, frustum, input });
                }
                program.queue.push({ graph, primitive, node, frustum, input });
            }
            lastPrimitive = primitive;
            
        }
        program?.run();
    }

    clear() {
        const { context: gl } = this.pipeline;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    createProgram({ graph, primitive, node }) {
        return new (this.program)(this.pipeline.context, { primitive, node, graph, settings: this.pipeline.settings });
    }
    
    getProgram({ graph, primitive, node }) {
        return this.#programs.get(primitive) || this.#programs.set(primitive, this.createProgram({ graph, primitive, node })).get(primitive);
    }

    reset() {
        this.#programs = new WeakMap();
        this.fbo?.reset();
    }
}

export default RenderNode;