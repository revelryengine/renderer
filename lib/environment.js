import { TEXTURE_USAGE } from './constants.js';
import { UBO } from './ubo.js';

export class Environment extends UBO {
    static layout = new UBO.Layout([        
        { name: 'exposure',               type: 'f32'                 },
        { name: 'mipLevelCount',          type: 'i32'                 },
        { name: 'irradianceCoefficients', type: 'vec3<f32>', count: 9 },
    ]);
}

export default Environment;
