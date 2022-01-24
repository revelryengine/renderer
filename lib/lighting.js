import { UBO } from './ubo.js';

export class Lighting extends UBO {
    static layout = new UBO.Layout([
        
        { name: 'lightCount', type: 'i32' },
        { name: 'lights', count: 12, type: 'Light', layout: [    
                { name: 'position',     type: 'vec3<f32>' },
                { name: 'direction',    type: 'vec3<f32>' },
                { name: 'color',        type: 'vec3<f32>' }, 

                { name: 'range',        type: 'f32'       },
                { name: 'intensity',    type: 'f32'       },

                { name: 'innerConeCos', type: 'f32'       },
                { name: 'outerConeCos', type: 'f32'       },

                { name: 'lightType',    type: 'i32'       },
                { name: 'shadowLayer',  type: 'i32'       },
            ],
        },    
        
        // { name: 'shadowCount',      type: 'i32'                   },
        // { name: 'shadowSplitCount', type: 'i32'                   },
        // { name: 'shadowSplits',     type: 'f32',         count: 5  },
        // { name: 'shadowMatrices',   type: 'mat4x4<f32>', count: 12 },
    ]);
}

export default Lighting;
