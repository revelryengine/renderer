import { RenderNode       } from './render-node.js';
import { ShadowProgram    } from '../programs/shadow-program.js';
import { Graph            } from '../graph.js';
import { mat4, vec3       } from '../../utils/gl-matrix.js';
import { Node             } from '../../node.js';
import { Camera           } from '../../camera.js';

import { LIGHT_TYPES      } from '../../extensions/KHR_lights_punctual.js';

const GL = WebGL2RenderingContext;

export class ShadowNode extends RenderNode {
    static type = 'geometry';

    static opaque = true;

    static program = ShadowProgram;

    static scaleFactor = 1.0;
    static square = true;

    static output = {
        shadow: { type: 'texture', attachmentType: 'depth', params: { 
            compareFunc: GL.LEQUAL, compareMode: GL.COMPARE_REF_TO_TEXTURE 
        } },
    }

    output = {
        ...this.output,
        matrix: mat4.create(),
    }

    constructor(pipeline) {
        super(pipeline);
        this.shadowGraph = new Graph();
        this.cameraNode = new Node({ matrix: mat4.create(), camera: new Camera({}) });
    }

    render(graph, { light }) {
        

        const { context: gl } = this.pipeline;
        const { scene } = graph;

        this.shadowGraph.settings = graph.settings;

        this.update(light);

        this.shadowGraph.analyze({ scene, cameraNode: this.cameraNode, viewport: { width: this.width, height: this.height } });

        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(2, 1);

        super.render(this.shadowGraph, {});

        gl.disable(gl.POLYGON_OFFSET_FILL);

        this.output.matrix = mat4.create();

        mat4.translate(this.output.matrix, this.output.matrix, [0.5, 0.5, 0.5]);
        mat4.scale(this.output.matrix, this.output.matrix, [0.5, 0.5, 0.5]);
        mat4.multiply(this.output.matrix, this.output.matrix, this.shadowGraph.viewInfo.projectionMatrix);
        mat4.multiply(this.output.matrix, this.output.matrix, mat4.invert(mat4.create(), this.cameraNode.matrix));

    }

    update(light) {
        const { cameraNode } = this;

        if(light.type === LIGHT_TYPES.spot) {
            const point = vec3.add(vec3.create(), light.position, light.direction);

            mat4.targetTo(cameraNode.matrix, light.position, point, vec3.fromValues(0, 1, 0));

            cameraNode.camera.type = 'perspective';
            cameraNode.camera.perspective = {
                yfov: Math.acos(light.outerConeCos) * 2,
                zfar: light.range,
                znear: 0.1,
            }
        }
    }
}

export class CascadedShadowNode extends ShadowNode {
    #cascades = [];

    resize({ width, height }) {
        super.resize({ width, height });
        for(const shadowNode of this.#cascades) {
            shadowNode.resize({ width: this.width, height: this.height });
        }
    }
}

/**
 * The Shadow Node is responsible for generating shadow maps for punctual lights.
 */
// export class ShadowNodeX extends RenderNode {
//     static scaleFactor = 1.0;
//     static square = true;

//     static output = {
//         // color:  { type: 'texture', attachmentType: 'color' },
//         // shadow: { type: 'texture', attachmentType: 'depth', params: { 
//         //     compareFunc: GL.LEQUAL, compareMode: GL.COMPARE_REF_TO_TEXTURE 
//         // } },
//     }

//     constructor(pipeline) {
//         super(pipeline);
//         this.shadowGraph = new Graph();
//     }

//     #shadowNodes = [];
//     getLightShadowNode(light) {
//         return this.#shadowNodes.get(light) || this.#shadowNodes.set(light, new LightShadowNode(this.pipeline, light)).get(light);
//     }

//     resize({ width, height }){
//         super.resize({ width, height });
//         for(const shadowNode of this.#shadowNodes) {
//             shadowNode.resize({ width: this.width, height: this.height });
//         }
//     }

//     render(graph) {
//         const { context: gl } = this.pipeline;

//         this.shadowGraph.settings = graph.settings;

//         this.#shadowNodes.length = graph.lights.length;

//         for(let i = 0; i < graph.lights.length; i++) {
//             let shadowNode = this.#shadowNodes[i];
//             if(!shadowNode) {
//                 this.#shadowNodes[i] = shadowNode = new LightShadowNode(this.pipeline);
//                 shadowNode.resize({ width: this.width, height: this.height });
//             }

//             /** @todo: check if light casts shadows */
//             shadowNode.render(graph, { light: graph.lights[i] });

//             graph.shadow = shadowNode.output.shadow;
//             graph.shadow.matrix = shadowNode.output.matrix;

//             // gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
//             // gl.bindTexture(gl.TEXTURE_2D, texture);
//             // gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT16, this.width, this.height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
//             // gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, texture, 0);

//             // // if(light.type === LIGHT_TYPES.directional) continue;

//             // const { scene } = graph;

//             // const cameraNode = this.getLightCamera(light, graph.cameraNode, graph.viewInfo);
            
//             // this.shadowGraph.analyze({ scene, cameraNode, viewport: { width: this.width, height: this.height } });

//             // this.shadowGraph.primitives.sort((a, b) => {
//             //     return (!!a.primitive.material?.extensions.KHR_materials_transmission - !!b.primitive.material?.extensions.KHR_materials_transmission) 
//             //             || (b.opaque - a.opaque) || (b.depth - a.depth);
//             // });

//             // gl.enable(gl.CULL_FACE); 
//             // gl.enable(gl.DEPTH_TEST); 
//             // gl.cullFace(gl.FRONT);
            
//         }
//         // return super.render(...arguments);
//     }

//     // getLightCamera(light, graphCameraNode, viewInfo) {
//     //     const { projectionMatrix, frustum } = viewInfo;
//     //     const { corners, center } = frustum;

//     //     light;
//     //     if(light.type === LIGHT_TYPES.directional) {
//     //         /** We want an orthopgraphic projection matrix bound to frustum corners. */

//     //         const matrix = mat4.create();

//     //         mat4.lookAt(matrix, vec3.create(), light.direction, vec3.fromValues(0, 1, 0));
//     //         mat4.invert(matrix, matrix);

//     //         // mat4.translate(matrix, matrix, vec3.scale(vec3.create(), center, 0.1));
//     //         // mat4.invert(matrix, matrix);

//     //         const cameraNode = new Node({ matrix });

//     //         let minX =  Infinity, minY =  Infinity, minZ =  Infinity;
//     //         let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

//     //         for(let i = 0; i < 8; i++){
//     //             const p = corners[i];

//     //             const v = vec4.transformMat4(vec4.create(), p, cameraNode.matrix);
//     //             minX = Math.min(minX, v[0]);
//     //             minY = Math.min(minY, v[1]);
//     //             minZ = Math.min(minZ, v[2]);

//     //             maxX = Math.max(maxX, v[0]);
//     //             maxY = Math.max(maxY, v[1]);
//     //             maxZ = Math.max(maxZ, v[2]);
//     //         }

//     //         cameraNode.camera = new Camera({
//     //             type: 'orthographic',
//     //             orthographic: {
//     //                 znear: minZ,
//     //                 zfar: maxZ,
//     //                 xmag: (maxX - minX) / 2,
//     //                 ymag: (maxY - minY) / 2,
//     //             },
//     //         });

//     //         // mat4.copy(graphCameraNode.matrix, matrix);
//     //         // graphCameraNode.camera.type = 'orthographic';
//     //         // graphCameraNode.camera.orthographic = {
//     //         //     znear: minZ,
//     //         //     zfar: maxZ,
//     //         //     xmag: (maxX - minX) / 2,
//     //         //     ymag: (maxY - minY) / 2,
//     //         // }
//     //         // graphCameraNode.camera.disableUpdate = true; 

//     //         return cameraNode;
            
//     //         // light.projectionMatrix = mat4.create();
//     //     } else if(light.type === LIGHT_TYPES.spot) {
//     //         /** We want a perspective projection matrix. */
//     //         const matrix = mat4.create();
//     //         const point = vec3.add(vec3.create(), light.position, light.direction);

//     //         mat4.targetTo(matrix, light.position, point, vec3.fromValues(0, 1, 0));

//     //         const cameraNode = new Node({ matrix });

//     //         cameraNode.camera = new Camera({
//     //             type: 'perspective',
//     //             perspective: {
//     //                 yfov: Math.acos(light.outerConeCos) * 2,
//     //                 zfar: light.range,
//     //                 znear: 0.1,
//     //             }
//     //         });

//     //         // mat4.copy(graphCameraNode.matrix, matrix);
//     //         // graphCameraNode.camera.perspective = {
//     //         //     yfov: Math.acos(light.outerConeCos) * 2,
//     //         //     zfar: light.range,
//     //         //     znear: 0.1,
//     //         // }
//     //         // graphCameraNode.camera.disableUpdate = true;

//     //         return cameraNode;
//     //     }
//     // }

    
// }

export default ShadowNode;