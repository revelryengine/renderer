import { GeometryNode } from './geometry-node.js';
import { vec3, mat4, quat } from '../../deps/gl-matrix.js';

import { Lighting  } from '../lighting.js';
import { LIGHT_TYPES } from '../constants.js';

/**
 * The Lighting Node is responsible for uploading all the punctual lighting information
 */
export class LightingNode extends GeometryNode {
    // attachments = {
    //     colors: [
    //         { name: 'color' }
    //     ],
    //     depth: { name: 'depth' },
    // }

    constructor(renderPath) {
        super(renderPath);
    }

    reconfigure(){
        this.lighting        = new Lighting(this.renderPath.gal);
        this.output.lighting = this.lighting;
    }

    run(_commandEncoder, { graph }) {
        this.lighting.lightCount = Math.min(graph.lights.length, this.lighting.lights.length);

        for(let i = 0, l = this.lighting.lightCount; i < l; i++) {
            Object.assign(this.lighting.lights[i], this.getLightUniformStruct(graph, graph.lights[i]));
        }

        this.lighting.exposure = 1;

        this.lighting.upload();
    }

    /**
    * Returns the object that can be passed to the uniform buffer struct
    * @param {Node} node
    * @returns {Object}
    */
    getLightUniformStruct(graph, node) {
        const { worldTransform } = graph.getState(node);
        const { light } = node.extensions.KHR_lights_punctual;

        const type = LIGHT_TYPES[light.type];
        const { color, intensity, range, spot } = light;
        
        const position = vec3.create();
        
        if(worldTransform){
            mat4.getTranslation(position, worldTransform);
        }
        
        const struct = { type, color, intensity, range, position };
        
        if(spot) {
            struct.innerConeCos = Math.cos(spot.innerConeAngle);
            struct.outerConeCos = Math.cos(spot.outerConeAngle);
        }
        
        if(light.type === 'directional' || light.type === 'spot') {
            struct.direction = vec3.fromValues(0.0, 0.0, -1.0);
            if(worldTransform){
                const rotation = quat.create();
                mat4.getRotation(rotation, worldTransform);
                quat.normalize(rotation, rotation);
                vec3.transformQuat(struct.direction, struct.direction, rotation);
            }      
        }
        return struct;
    }
}

export default LightingNode;