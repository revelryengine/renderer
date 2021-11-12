import { UBO } from './ubo.js';

const GL = WebGL2RenderingContext;

export class LightingUBO extends UBO {
    static location = 2;
    
    static layout = new UBO.Layout([
        // { name: 'u_LightCount',       type: GL.INT },
        { name: 'u_Lights', size: 12, struct: 'Light', layout: [    
                { name: 'position',     type: GL.FLOAT_VEC3 },
                { name: 'direction',    type: GL.FLOAT_VEC3 },
                { name: 'color',        type: GL.FLOAT_VEC3 }, 

                { name: 'range',        type: GL.FLOAT      },
                { name: 'intensity',    type: GL.FLOAT      },

                { name: 'innerConeCos', type: GL.FLOAT      },
                { name: 'outerConeCos', type: GL.FLOAT      },

                { name: 'type',         type: GL.INT        },
                { name: 'shadowLayer',  type: GL.INT        },
            ],
        },
        { name: 'u_ShadowCount',      type: GL.INT                  },
        { name: 'u_ShadowSplitCount', type: GL.INT                  },
        { name: 'u_ShadowSplits',     type: GL.FLOAT,      size: 5  },
        { name: 'u_ShadowMatrices',   type: GL.FLOAT_MAT4, size: 12 },
    ]);    
}

export default LightingUBO;
