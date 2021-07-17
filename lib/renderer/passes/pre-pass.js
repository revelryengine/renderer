import { RenderPass } from './render-pass.js';
import { PreProgram } from '../programs/pre-program.js';

/**
 * The Pre Pass is responsible for capturing the linear output of all opaque objects along with position, depth and normals.
 */
export class PrePass extends RenderPass {
    constructor(context) {
        super('pre', context, { scaleFactor: 0.5, powerOf2: true });

        const gl = context;

        this.opaqueTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.opaqueTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,     gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,     gl.CLAMP_TO_EDGE);      

        this.normalTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.normalTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,     gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,     gl.CLAMP_TO_EDGE);
        
        this.depthTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.depthTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,     gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,     gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);

        this.framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.opaqueTexture, 0);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.normalTexture, 0);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.depthTexture, 0);

        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    resize() {
        super.resize(...arguments);

        const { context: gl, opaqueTexture, normalTexture, depthTexture, framebuffer, viewport } = this;
        const { width, height } = viewport.scaled;

        gl.bindTexture(gl.TEXTURE_2D, opaqueTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        gl.bindTexture(gl.TEXTURE_2D, normalTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        gl.bindTexture(gl.TEXTURE_2D, depthTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT16, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);

        gl.bindTexture(gl.TEXTURE_2D, null);

        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.viewport(0, 0, width, height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); 

        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if(status != gl.FRAMEBUFFER_COMPLETE){
            console.warn('Pre Pass framebuffer error:', RenderPass.GL_FRAMEUBUFFER_STATUS_ERRORS[status]);
        }
    }

    render(graph) {
        const { context: gl, opaqueTexture, normalTexture, depthTexture, framebuffer, viewport } = this;

        graph.primitives.sort((a, b) => {
            return (!!a.primitive.material?.extensions.KHR_materials_transmission - !!b.primitive.material?.extensions.KHR_materials_transmission) 
                    || (a.blend - b.blend) || (b.depth - a.depth);
        });

        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); 
        gl.viewport(0, 0, viewport.scaled.width, viewport.scaled.height);
        gl.enable(gl.DEPTH_TEST);

        for(const { primitive, node } of graph.primitives) {
            if(primitive.material?.extensions?.KHR_materials_transmission) continue;
            this.renderPrimitive(primitive, node, graph);
        }

        gl.viewport(0, 0, viewport.width, viewport.height);
        gl.bindTexture(gl.TEXTURE_2D, opaqueTexture);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.bindTexture(gl.TEXTURE_2D, normalTexture);
        gl.generateMipmap(gl.TEXTURE_2D);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        
        return { opaqueTexture, depthTexture, normalTexture, framebuffer, ...viewport.scaled };
    }

    createPrimitiveProgram(primitive, node, graph) {
        const program = new PreProgram(this.context, primitive, node, graph, {
            USE_IBL:      graph.useIBL ? 1 : null,
            USE_PUNCTUAL: graph.usePunctual ? 1 : null,
        });
        return program;
    }
}

export default PrePass;