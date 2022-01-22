import { GeometryNode     } from './render-node.js';
import { FBO              } from '../fbo.js';
import { ShadowProgram    } from '../programs/gltf/shadow-program.js';

import { Frustum          } from '../../utils/frustum.js';
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

export class LightingNode extends GeometryNode {
    opaque = true;

    program = ShadowProgram;
    
    scaleFactor = 4;
    square = true; //square to avoid cropping with spot light projections

    fbo = new FBO(this.pipeline.context, {
        // Uncomment color for debugging purposes
        // colors: [
        //     { name: 'color' },
        // ],
        depth: { 
            name: 'shadows',
            params: { 
                min: GL.LINEAR, mag: GL.LINEAR,
                compareFunc: GL.LEQUAL, compareMode: GL.COMPARE_REF_TO_TEXTURE,
                array: true, depth: 12,
            }
        },
    })

    output = {
        // Uncomment color for debugging purposes
        // color:   { type: 'texture' },
        shadows: { type: 'texture' },
    }

    
    constructor(pipeline) {
        super(pipeline);
    
        this.shadowFrustum = new Frustum(pipeline.context, { alphaSort: false });

        this.cameraNode = new Node({ matrix: mat4.create(), camera: new Camera({}) });

        this.shadowMatrices = [];
    }

    #temporalCount = 0; //used for alternative frame renders of shadows (temporal coherence)
    resize(...args) {
        this.scaleFactor = this.pipeline.settings.shadows.scaleFactor || 4;
        super.resize(...args);
    }

    run({ graph, frustum }) {
        if(!this.pipeline.settings.shadows.enabled || !this.pipeline.settings.punctual.enabled) return;
        const settings = this.pipeline.settings.shadows;

        this.#temporalCount = (this.#temporalCount + 1);

        this.shadowFrustum.bind();

        const { context: gl } = this.pipeline;

        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(1, settings.bias);

        const { near, far } = frustum;

        let layer = 0;

        const splits = LightingNode.calculateSplitDistances(near, far, settings.lambda, settings.cascades);

        for(const light of graph.lights) {
            switch(light.type) {
                case LIGHT_TYPES.directional: {
                    light.shadowLayer = layer;
                    for(let i = 0; i < splits.length - 1; i++) {
                        if(i === 0 || this.#temporalCount % i === 0) {
                            this.updateFrustum(light, frustum, splits[i], splits[i + 1]);
                            graph.updateNode(this.cameraNode);
                            this.shadowMatrices[light.shadowLayer + i] = this.renderShadow(graph, light.shadowLayer + i);
                        }
                    }
                    layer += splits.length - 1;
                    break;
                }
                case LIGHT_TYPES.spot: {
                    light.shadowLayer = layer++;
                    this.updateFrustum(light, frustum);
                    graph.updateNode(this.cameraNode);
                    this.shadowMatrices[light.shadowLayer] = this.renderShadow(graph, light.shadowLayer);
                    break;
                }
            }
        }

        this.shadowMatrices.length = layer;

        // this.output.shadows.matrices = new Float32Array(16 * matrices.length);
        // for(let i = 0; i < matrices.length; i++) {
        //     for (let j = 0; j < 16; j++){
        //         this.output.shadows.matrices[i * 16 + j] = matrices[i][j];
        //     }
        // }

        // this.output.shadows.splits = splits;

        gl.disable(gl.POLYGON_OFFSET_FILL);

        frustum.bind();

        this.updateLightingUBO({ graph, splits });

        return this.output;
    }

    updateLightingUBO({ graph, splits }) {
        const { shadows } = this.pipeline.settings;

        const shadowMultiplier = { [LIGHT_TYPES.spot]: 1, [LIGHT_TYPES.directional]: shadows.cascades, [LIGHT_TYPES.point]: 0 };
        const shadowCount = graph.lights.reduce((sum, light) => sum + shadowMultiplier[light.type], 0);

        const { lightingUBO } = this.pipeline;
        lightingUBO.set({
            // u_LightCount:       graph.lights.length,
            u_Lights:           graph.lights,
            u_ShadowCount:      shadowCount,
            // u_ShadowSplitCount: shadows.cascades,
            u_ShadowSplits:     splits,
            u_ShadowMatrices:   this.shadowMatrices,
        });
        lightingUBO.upload();
        lightingUBO.bind();
    }

    renderShadow(graph, layer) {
        const { context: gl } = this.pipeline;
        // const { scene } = graph;

        // this.shadowGraph.analyze({ scene, cameraNode: this.cameraNode, viewport: { width: this.width, height: this.height } });

        const { glTexture } = this.fbo.attachments.depth;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo.framebuffer);
        gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, glTexture, 0, layer);
        
        /** Uncomment for debugging purposes */
        // const color = this.textures.find(({ name }) => name === 'color');
        // gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, color.glTexture, 0, layer);

        this.shadowFrustum.update({ graph, cameraNode: this.cameraNode, viewport: { width: this.width, height: this.height } })
        super.run({ graph, frustum: this.shadowFrustum });

        const matrix = mat4.create();
        mat4.translate(matrix, matrix, [0.5, 0.5, 0.5]);
        mat4.scale(matrix, matrix, [0.5, 0.5, 0.5]);
        mat4.multiply(matrix, matrix, this.shadowFrustum.viewProjectionMatrix);

        return matrix; 
    }

    updateFrustum(light, frustum, near, far) {
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
            const { center, radius } = LightingNode.calculateBoundingSphere(frustum, near, far);

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
     * @param {Object} frustum - The frustum
     * @param {Number} start - The previous split distance
     * @param {Number} end - The split distance
     */
    static calculateBoundingSphere(frustum, start, end) {
        const corners = [...new Array(8)].map(() => vec4.create());

        for(let i = 0; i < 8; i++) {
            vec4.transformMat4(corners[i], FRUSTUM_CUBE[i], frustum.invViewProjectionMatrix);
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

    // renderDebug(output) {
    //     const { context: gl } = this.pipeline;
    //     const size = output.height / 3;
    //     const count = this.output.shadows.matrices.length / 16;
    //     for(let i = 0; i < count; i++) {
    //         gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    //         gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, this.output.color.glTexture, 0, i);
    //         RenderNode.blitFramebuffer(gl, this, { x: 0, y: output.height - ((i + 1) * size), width: size, height: size }, gl.COLOR_BUFFER_BIT);
    //     }
    // }
}

export default LightingNode;