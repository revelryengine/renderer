import { RenderNode       } from './render-node.js';
import { ShadowProgram    } from '../programs/shadow-program.js';
import { Graph            } from '../graph.js';
import { mat4, vec3, vec4 } from '../../utils/gl-matrix.js';
import { Node             } from '../../node.js';
import { Camera           } from '../../camera.js';

import { LIGHT_TYPES      } from '../../extensions/KHR_lights_punctual.js';

const GL = WebGL2RenderingContext;

/**
 * A unit cube in WebGL coordinates
 */
const FRUSTUM_CUBE = [
    vec4.fromValues(-1, 1,-1, 1),
    vec4.fromValues( 1, 1,-1, 1),
    vec4.fromValues( 1,-1,-1, 1),
    vec4.fromValues(-1,-1,-1, 1),
    vec4.fromValues(-1, 1, 1, 1),
    vec4.fromValues( 1, 1, 1, 1),
    vec4.fromValues( 1,-1, 1, 1),
    vec4.fromValues(-1,-1, 1, 1),
];

export class ShadowNode extends RenderNode {
    type = 'geometry';

    opaque = true;

    program = ShadowProgram;
    
    scaleFactor = 4;
    square = true; //square to avoid cropping with spot light projections

    textures = [
        // Uncomment color for debugging purposes
        // { name: 'color', type: 'color', params: { array: true, depth: 12 } },
        { name: 'shadows', type: 'depth', params: { 
            min: GL.LINEAR, mag: GL.LINEAR,
            compareFunc: GL.LEQUAL, compareMode: GL.COMPARE_REF_TO_TEXTURE,
            array: true, depth: 12,
        } },
    ]

    output = {
        // Uncomment color for debugging purposes
        // color:   { type: 'texture' },
        shadows: { type: 'texture' },
    }

    constructor(pipeline) {
        super(pipeline);
        this.shadowGraph = new Graph();
        this.cameraNode = new Node({ matrix: mat4.create(), camera: new Camera({}) });
    }

    render(graph) {
        if(!graph.settings.shadows.enabled || !graph.settings.punctual.enabled) return { skipped: true };
        const { context: gl } = this.pipeline;

        this.shadowGraph.settings = graph.settings;

        let layer = 0;

        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(1, graph.settings.shadows.bias);

        const matrices = [];
        for(const light of graph.lights) {
            switch(light.type) {
                case LIGHT_TYPES.directional: {
                    const { projectionMatrix } = graph.viewInfo;
                    const near   = projectionMatrix[14] / (projectionMatrix[10] - 1.0);
                    const far    = projectionMatrix[14] / (projectionMatrix[10] + 1.0);
                    const splits = ShadowNode.calculateSplitDistances(near, far, graph.settings.shadows.lambda, graph.settings.shadows.cascades);
                    for(let i = 0; i < splits.length - 1; i++) {
                        this.updateCamera(light, graph.viewInfo, splits[i], splits[i + 1]);
                        matrices.push(this.renderShadow(graph, light, layer++));
                    }   
                    this.output.shadows.splits = splits;
                    break;
                }
                case LIGHT_TYPES.spot: {
                    this.updateCamera(light, graph.viewInfo);
                    matrices.push(this.renderShadow(graph, light, layer++));
                    break;
                }
            }
        }

        this.output.shadows.matrices = new Float32Array(16 * matrices.length);
        for(let i = 0; i < matrices.length; i++) {
            for (let j = 0; j < 16; j++){
                this.output.shadows.matrices[i * 16 + j] = matrices[i][j];
            }
        }

        gl.disable(gl.POLYGON_OFFSET_FILL);

        return this.output;
    }

    renderShadow(graph, light, layer) {
        const { context: gl } = this.pipeline;
        const { scene } = graph;

        

        light.shadowLayer = light.shadowLayer === undefined ? light.shadowLayer : layer;
            
        this.shadowGraph.analyze({ scene, cameraNode: this.cameraNode, viewport: { width: this.width, height: this.height } });
        

        const shadows = this.textures.find(({ name }) => name === 'shadows');
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, shadows.glTexture, 0, layer);
        
        /** Uncomment for debugging purposes */
        // const color = this.textures.find(({ name }) => name === 'color');
        // gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, color.glTexture, 0, layer);

        super.render(this.shadowGraph);

        const matrix = mat4.create();
        mat4.translate(matrix, matrix, [0.5, 0.5, 0.5]);
        mat4.scale(matrix, matrix, [0.5, 0.5, 0.5]);
        mat4.multiply(matrix, matrix, this.shadowGraph.viewInfo.viewProjectionMatrix);

        return matrix; 
    }

    updateCamera(light, viewInfo, near, far) {
        const { cameraNode } = this;

        if(light.type === LIGHT_TYPES.spot) {
            const point = vec3.add(vec3.create(), light.position, light.direction);

            mat4.targetTo(cameraNode.matrix, light.position, point, vec3.fromValues(0, 1, 0));

            cameraNode.camera.type = 'perspective';
            cameraNode.camera.perspective = {
                yfov: Math.acos(light.outerConeCos) * 2,
                zfar: light.range,
                znear: 0.1,
            };
        } else if(light.type === LIGHT_TYPES.directional) {
            const { center, radius } = ShadowNode.calculateBoundingSphere(viewInfo, near, far);

            const texelsPerUnit = this.width / (radius * 2);

            const scalar     = mat4.fromScaling(mat4.create(), vec3.fromValues(texelsPerUnit, texelsPerUnit, texelsPerUnit));
            const zero       = vec3.create();
            const up         = vec3.fromValues(0, 1, 0);
            const lookAt     = mat4.create();
            const lookAtInv  = mat4.create();
            const baseLookAt = vec3.fromValues(-light.direction[0], -light.direction[1], -light.direction[2]);

            mat4.lookAt(lookAt, zero, baseLookAt, up);
            mat4.mul(lookAt, lookAt, scalar);
            mat4.invert(lookAtInv, lookAt);

            vec3.transformMat4(center, center, lookAt);
            center[0] = Math.floor(center[0]);
            center[1] = Math.floor(center[1]);
            vec3.transformMat4(center, center, lookAtInv);

            const eye = vec3.sub(vec3.create(), center, vec3.scale(vec3.create(), light.direction, radius * 2));

            mat4.targetTo(cameraNode.matrix, eye, center, up);

            cameraNode.camera.type = 'orthographic';
            cameraNode.camera.orthographic = {
                znear: -radius * 4,
                zfar:  radius * 4,
                xmag:  radius, 
                ymag:  radius,
            }            
        }
    }

    /**
     * Calculates the bounding sphere for a given view frustum and split distances
     * 
     * @param {Object} viewInfo - The graph viewInfo
     * @param {Number} start - The previous split distance
     * @param {Number} end - The split distance
     */
    static calculateBoundingSphere(viewInfo, start, end) {
        const corners = [...new Array(8)].map(() => vec4.create());

        for(let i = 0; i < 8; i++) {
            vec4.transformMat4(corners[i], FRUSTUM_CUBE[i], viewInfo.invViewProjectionMatrix);
            vec4.scale(corners[i], corners[i], 1 / corners[i][3]);
        }

        for(let i = 0; i < 4; i++) {
            const ray  = vec3.create();
            const near = vec3.create();
            const far  = vec3.create();

            vec3.sub(ray,  corners[i + 4], corners[i]);
            vec3.normalize(ray, ray);
            vec3.scale(near, ray, start);
            vec3.scale(far,  ray, end);

            vec3.add(corners[i + 4], corners[i], far);
            vec3.add(corners[i], corners[i], near);
        }
        
        const center = vec3.create();
        for(let i = 0; i < 8; i++) {
            vec3.add(center, center, corners[i]);
        }
        vec3.scale(center, center, 1/8);

        let radius = 0;
        for(let i = 0; i < 8; i++) {
            radius = Math.max(radius, vec3.distance(corners[i], center));
        }
        radius = Math.ceil(radius * 16) / 16; // Step by 0.125

        return { center, radius };
    }

    /**
     * Calculates the split distances for the view frustum
     * @param {Number} n - The near plane
     * @param {Number} f - The far plane
     * @param {Number} l - The lambda coefficient that determines the interpolation between the logarithmic and a uniform partition scale
     * @param {Number} m - The number of splits
     * @see: https://developer.nvidia.com/gpugems/gpugems3/part-ii-light-and-shadows/chapter-10-parallel-split-shadow-maps-programmable-gpus
     */
    static calculateSplitDistances(n, f, l, m) {
        const c = [];
        for(let i = 0; i < m; i++) {
            const log = n * Math.pow(f / n, i / m);
            const uni = n + (f - n) * (i / m);
            c[i] = (l * uni) + ((1 - l) * log);
        }
        return [...c, f];
    }

    renderDebug(output) {
        const { context: gl } = this.pipeline;
        const size = output.height / 3;
        const count = this.output.shadows.matrices.length / 16;
        for(let i = 0; i < count; i++) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
            gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, this.output.color.glTexture, 0, i);
            RenderNode.blitFramebuffer(gl, this, { x: 0, y: output.height - ((i + 1) * size), width: size, height: size }, gl.COLOR_BUFFER_BIT);
        }
    }
}

export default ShadowNode;