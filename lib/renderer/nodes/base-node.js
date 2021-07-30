import { RenderNode  } from './render-node.js';
import { ShadowNode, CascadedShadowNode  } from './shadow-node.js';
import { BaseProgram } from '../programs/base-program.js';
import { LIGHT_TYPES } from '../../extensions/KHR_lights_punctual.js';


const SHADOW_NODE_CONSTRUCTORS = {
    [LIGHT_TYPES.spot]: ShadowNode,
    [LIGHT_TYPES.directional]: CascadedShadowNode,
}

/**
 * The Base Node is responsible for capturing the linear output of all opaque objects along with depth and normals. 
 * It will also delegate rendering of shadow maps for all spot/directional lights in the scene.
 */
export class BaseNode extends RenderNode {
    static type = 'geometry';
    static opaque = true;

    static program = BaseProgram;

    static scaleFactor = 0.5;

    #shadowNodes = {
        [LIGHT_TYPES.spot]: [],
        // [LIGHT_TYPES.directional]: [],
    };

    // static multisample = true;

    static output = {
        color:  { type: 'texture', attachmentType: 'color' },
        normal: { type: 'texture', attachmentType: 'color' },
        depth:  { type: 'texture', attachmentType: 'depth' },
    }

    resize({ width, height }){
        super.resize({ width, height });

        for(const type in this.#shadowNodes) {
            for(const shadowNode of this.#shadowNodes[type]) {
                shadowNode.resize({ width: this.width, height: this.height });
            }
        }
        
    }

    render(graph) {
        this.renderShadowMaps(graph);
        return super.render(...arguments);
    }

    renderShadowMaps(graph) {
        /** @todo: check if light should cast shadows */

        for(const type in this.#shadowNodes) {
            this.#shadowNodes[type].length = graph.lights.filter(light => light.type === type).length;
        }
        
        // this.#shadowNodes[LIGHT_TYPES.directional].length = graph.lights.filter(({ type }) => type === LIGHT_TYPES.directional).length;
        // this.#cascadedShadowNodes.length = graph.lights.filter(({ type }) => type === LIGHT_TYPES.directional).length;

        const count = {
            [LIGHT_TYPES.spot]: 0,
            [LIGHT_TYPES.directional]: 0,
        };

        for(const light of graph.lights) {
            const { type } = light;
            if(type === LIGHT_TYPES.directional) continue;

            let node = this.#shadowNodes[type][count[type]];

            if(!node) {
                node = this.#shadowNodes[type][count[type]] = new SHADOW_NODE_CONSTRUCTORS[type](this.pipeline);
                node.resize({ width: this.width, height: this.height });
            }

            count[type]++;

            node?.render(graph, { light });

            // This is just temporary, these should be added to the light struct instead
            graph.shadow = node.output.shadow;
            graph.shadow.matrix = node.output.matrix;
        }
    }

    
}

export default BaseNode;