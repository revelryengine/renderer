import { UBO } from './ubo.js';

export class Environment extends UBO {
    static layout = new UBO.Layout([        
        { name: 'mipLevelCount',          type: 'i32'                 },
        { name: 'irradianceCoefficients', type: 'vec3<f32>', count: 9 },
        { name: 'localized',              type: 'u32'                 }, 
        { name: 'boundingBoxMin',         type: 'vec3<f32>'           },
        { name: 'boundingBoxMax',         type: 'vec3<f32>'           },
    ]);
}

export default Environment;
