import { Texture } from '../../texture.js';

const gl = WebGL2RenderingContext;

export class RenderPass {
    constructor(name, context, { scaleFactor = 1, powerOf2 = false}) {
        this.name = name;
        this.context  = context;

        this.programs = new WeakMap();

        this.scaleFactor = scaleFactor;
        this.powerOf2 = powerOf2;
    }

    resize({ width, height }) {
        this.viewport = { 
            width, height,
            scaled: {
                width: width  * this.scaleFactor,
                height: height * this.scaleFactor,
            },
        };

        if(this.powerOf2) {
            this.viewport.scaled.width  = Texture.nearestUpperPowerOf2(this.viewport.scaled.width);
            this.viewport.scaled.height = Texture.nearestUpperPowerOf2(this.viewport.scaled.height);
        }
    }

    render(/* graph */) {
        console.warn('render method not implemented on', this.constructor.name);
    }

    createPrimitiveProgram(/* primitive, node */) {
        console.warn('createPrimitiveProgram method not implemented on', this.constructor.name);
    }

    renderPrimitive(primitive, node, graph) {
        const program = this.getPrimitiveProgram(primitive, node, graph);
        program.run(primitive, node, graph);
    }
    
    getPrimitiveProgram(primitive, node, graph) {
        return this.programs.get(primitive) || this.programs.set(primitive, this.createPrimitiveProgram(primitive, node, graph)).get(primitive);
    }

    clearProgramCache() {
        this.programs = new WeakMap();
    }

    static GL_FRAMEUBUFFER_STATUS_ERRORS = {
        [gl.FRAMEBUFFER_UNSUPPORTED]:                   'FRAMEBUFFER_UNSUPPORTED',
        [gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT]:         'FRAMEBUFFER_INCOMPLETE_ATTACHMENT',
        [gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT]: 'FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT',
        [gl.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE]:        'FRAMEBUFFER_INCOMPLETE_MULTISAMPLE',
    }
}

export default RenderPass;