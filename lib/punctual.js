import { UBO } from './ubo.js';

const MAX_LIGHT_COUNT = 12;
const MAX_SHADOW_COUNT = 6;

export class Punctual extends UBO.Layout({
    lights: { count: MAX_LIGHT_COUNT, type: 'Light', layout: {
            position:     { type: 'vec3<f32>' },
            direction:    { type: 'vec3<f32>' },
            color:        { type: 'vec3<f32>' },

            range:        { type: 'f32'       },
            intensity:    { type: 'f32'       },

            innerConeCos: { type: 'f32'       },
            outerConeCos: { type: 'f32'       },

            lightType:    { type: 'i32'       },
            shadowLayer:  { type: 'i32'       },
        },
    },
    lightCount:          { type: 'i32'       },
    shadowCount:         { type: 'i32'       },
    shadowCascadeCount:  { type: 'i32'       },
    shadowCascadeDepths: { type: 'vec4<f32>' },
    shadowMatrices:      { type: 'mat4x4<f32>', count: MAX_SHADOW_COUNT  },
}){}
