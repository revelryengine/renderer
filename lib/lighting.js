import { TEXTURE_USAGE } from './constants.js';
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

    // constructor(gal) {
    //     super(gal);

    //     this.environmentViews = this.#getEmptyEnvironmentViews();
    // }

    // #getEmptyEnvironmentViews() {
    //     const format        = 'rgba16float';
    //     const size          = { width: 1, height: 1, depthOrArrayLayers: 6 };
    //     const usage         = TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.RENDER_ATTACHMENT;
    //     const mipLevelCount = 1;

    //     const envGGX     = this.gal.device.createTexture({ label: 'Empty GGX',     format, size, mipLevelCount, usage, cubemap: true });
    //     const envCharlie = this.gal.device.createTexture({ label: 'Empty Charlie', format, size, mipLevelCount, usage, cubemap: true });
    //     const envLUT     = this.gal.device.createTexture({ label: 'Empty LUT',     format, size: { width: 1, height: 1 }, usage });
    //     const envSampler = this.gal.device.createSampler({ label: 'Empty Sampler', minFilter: 'linear', magFilter: 'linear', mipmapFilter: 'linear' });
    //     const views      = {
    //         envGGX     : envGGX.createView({ dimension: 'cube' }),
    //         envCharlie : envCharlie.createView({ dimension: 'cube' }),
    //         envLUT     : envLUT.createView({ dimension: '2d' }),
    //         envSampler,
    //     }
    //     return views;
    // }
}

export default Lighting;
