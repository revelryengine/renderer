import { UBO } from '../../ubo.js';

export class Settings extends UBO {
    static layout = new UBO.Layout([
        { name: 'grid', type: 'Grid', layout: [
            { name: 'colors', type: 'GridColors', layout: [
                { name: 'thick', type: 'vec4<f32>' },
                { name: 'thin',  type: 'vec4<f32>' },
            ]},
            { name: 'increment',  type: 'f32' },
        ] },
        { name: 'depthHint', type: 'DepthHint', layout: [
            { name: 'factor',  type: 'f32'  },
        ]}
    ]);

    static defaults = {
        grid:      { enabled: false, increment: 0.1, colors: { thick: [1, 1, 1, 0.25], thin: [1, 1, 1, 0.1] } },
        msaa:      { enabled: true,  samples: 4 },
        taa:       { enabled: false },
        depthHint: { factor: 0 },
        outline:   { enabled: true  },
    }

    get temporal() {
        return this.taa.enabled;
    }
}

export default Settings;
