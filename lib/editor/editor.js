import { Scene, Camera, Node, Mesh, Skin, Accessor, Buffer, BufferView, Material } from '../webgltf.js';
import { Graph } from '../utils/graph.js';
import { PlaneGeometry } from './geometry/plane.js';
import { CubeGeometry  } from './geometry/cube.js';

import { KHRLightsPunctualLight    } from '../extensions/KHR_lights_punctual.js';
import { KHRMaterialsUnlitMaterial } from '../extensions/KHR_materials_unlit.js';

const GL = WebGL2RenderingContext;

export class Editor {
    constructor(graph, webgltf) {
        this.webgltf = webgltf;
        this.graph   = graph;
    }

    /**
     * Appends a node to the root scene or specified destination scene/node. 
     * Automatically adds all sub reference objects to webgltf root collections.
     */
    appendNode(node, to = this.webgltf.scene) {
        const { webgltf } = this;
        const { scene   } = webgltf;

        // this.graph.analyze({ scene });

        const parent = this.graph.getParent(node);
        if(parent) {
            const index = parent.children.indexOf(node);
            parent.children.splice(index, 1);
        }

        const dest = to.nodes || to.children;
        if(dest.indexOf(node) === -1) dest.push(node);
        if(webgltf.nodes.indexOf(node) === -1) webgltf.nodes.push(node);

        node.ensureReferences(webgltf, 'nodes');

        this.graph.updateNode(node);


        // console.log(webgltf);
        return node;
    }

    /**
     * Adds a new scene to the glTF object
     * @param {String} [name] - The name of the scene.
     * @returns {scene}
     */
    newScene(name) {
        const { webgltf } = this;

        const scene = new Scene({ name });
        webgltf.scenes.push(scene);
        webgltf.scene = scene;
        return scene;
    }

    /**
     * Creates a new camera and adds it to the scene. A camera in glTF is essentially a Node with a reference to
     * optic properties which is also called "camera". Therefore the transform matrix is required to create a camera and
     * the returned value is the node, not the camera optics object.
     * @param {String} [name] - The name of the camera
     * @param {String} [nodeName] - The name of the node
     * @param {String} [type='perspective'] - The type of camera to create. The available types are 'perspective' and 'orthographic'
     * @param {perspective|orthographic} [optics={ yfov: 45 * (Math.PI / 180), znear: 0.01, zfar: 100 }] - The properties of the camera optics.
     * @param {Object} [transform] - The transform of the node.
     * @param {Number[]} [transform.matrix=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]] - A floating-point 4x4 transformation matrix
     * stored in column-major order.
     * @param {Number[]} [transform.rotation=[0,0,0,1]] - The node's unit quaternion rotation in the order (x, y, z, w),
     * where w is the scalar.
     * @param {Number[]} [transform.scale=[1,1,1]] - The node's non-uniform scale, given as the scaling factors along the
     * x, y, and z axes.
     * @param {Number[]} [transform.translation=[0,0,0]] - The node's translation along the x, y, and z axes.
     */
    newCamera({ name, type = 'perspective', optics = { yfov: 45 * (Math.PI / 180), znear: 0.01, zfar: 100 }, transform = {} } = {}) {
        return this.appendNode(new Node({ name, camera: new Camera({ name, type, [type]: optics }), ...transform }));
    }

    /**
     * Creates a new light and adds it to the scene.
     */
    newLight({ name, type, color, intensity, range, spot, transform = {} } = {}) {
        const light = new KHRLightsPunctualLight({ name, type, color, intensity, range, spot });
        return this.appendNode(new Node({ name, extensions: { KHR_lights_punctual: { light } }, ...transform }));
    }

    /**
     * Creates a new plane and adds it to the scene
     */
    newPlane({ name, size = 1, material = new Material(), transform = {} } = {}) {
        const geometry = new PlaneGeometry({ size });
        const { indices, POSITION } = geometry.accessors;

        const mesh = new Mesh({ primitives: [
            { mode: GL.TRIANGLES, indices, attributes: { POSITION }, material },
        ] });

        return this.appendNode(new Node({ name, mesh, ...transform }));
    }


    /**
     * Creates a new cube and adds it to the scene
     */
    newCube({ name, size = 1, material = new Material(), transform = {} } = {}) {
        const geometry = new CubeGeometry({ size });
        const { indices, POSITION } = geometry.accessors;

        const mesh = new Mesh({ primitives: [
            { mode: GL.TRIANGLES, indices, attributes: { POSITION }, material },
        ] });

        return this.appendNode(new Node({ name, mesh, ...transform }));
    }
    /** 
     * Wraps the default scene from another WEbGLTF asset in a node and adds it to the scene.
     * It will create copies of all nodes to avoid reference confusion between assets.
     */
    import({ src, transform = {} }) {
        const scene = src.scene || src.scenes[0];

        const refs = new WeakMap();

        for (const node of scene.depthFirstSearch()) {
            const copy = new Node({ ...node, children: node.children.map(n => refs.get(n)) });
            refs.set(node, copy);
        }

        for (const node of scene.depthFirstSearch()) {
            if(node.skin) {
                const copy = refs.get(node);
                copy.skin = new Skin({ ...node.skin, skeleton: refs.get(node.skin.skeleton), joints: node.skin.joints.map(j => refs.get(j)) });
            }
        }

        return this.appendNode(new Node({ children: scene.nodes.map(n => refs.get(n)), ...transform }))
    }

    createLineGridPlane({ transform = {}, size = 10, divisions = 10, name, unlit = true, alphaMode = 'BLEND', color = [0, 0, 0, 1] }) {
        const { webgltf } = this;
        const { scene } = webgltf;

        const count      = 4 * (divisions + 1);
        const byteLength = count * 3 * 4;

        const buffer     = new Buffer({ byteLength });
        const bufferView = new BufferView({ buffer, byteLength, target: GL.ARRAY_BUFFER });
        const accessor   = new Accessor({ type: 'VEC3', componentType: GL.FLOAT, bufferView, count });
        const material   = new Material({ alphaMode, pbrMetallicRoughness: { baseColorFactor: color }});

        if(unlit) {
            material.extensions.KHR_materials_unlit = new KHRMaterialsUnlitMaterial();
        }

        accessor.initBufferData();

        const mesh = new Mesh({ primitives: [
            { mode: GL.LINES, attributes: { POSITION: accessor }, material },
        ] });

        const lines = new Float32Array(buffer.getArrayBuffer());
        const length = size / 2;
        const step   = size / divisions;

        let offset = 0;
        for (let x = -length; x <= length; x += step) {
            lines[offset + 0] = x;
            lines[offset + 1] = -length;
            lines[offset + 2] = 0;
            lines[offset + 3] = x;
            lines[offset + 4] = length;                                                                                                        
            lines[offset + 5] = 0;
            offset += 6;
        }

        for (let y = -length; y <= length; y += step) {
            lines[offset + 0] = -length;
            lines[offset + 1] = y;
            lines[offset + 2] = 0;
            lines[offset + 3] = length;
            lines[offset + 4] = y;                                                                                                        
            lines[offset + 5] = 0;
            offset += 6;
        }

        const node = new Node({ ...transform, mesh, name });
        
        webgltf.nodes.push(node);
        scene.nodes.push(node);

        return node;
    }
}



export default Editor;
