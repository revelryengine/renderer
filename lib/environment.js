import { UBO } from './ubo.js';

export class Environment extends UBO.Layout({
    mipLevelCount:          { type: 'i32'                 },
    irradianceCoefficients: { type: 'vec3<f32>', count: 9 },
    localized:              { type: 'u32'                 },
    boundingBoxMin:         { type: 'vec3<f32>'           },
    boundingBoxMax:         { type: 'vec3<f32>'           },
}){}
