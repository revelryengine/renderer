import { UBO } from '../../ubo.js';

export class Settings extends UBO.Layout({
    grid: { type: 'Grid', layout: {
        colors: { type: 'GridColors', layout: {
            thick: { type: 'vec4<f32>' },
            thin:  { type: 'vec4<f32>' },
        }},
        increment: { type: 'f32' },
    } },
    depthHint: { type: 'DepthHint', layout: {
        factor: { type: 'f32'  },
    } },
}, {
    grid: { increment: 0.1, colors: { thick: [1, 1, 1, 0.25], thin: [1, 1, 1, 0.1] } },
    depthHint: { factor: 0 },
}){
    enabled = /** @type {Record<'grid'|'msaa'|'taa'|'outline', boolean|undefined>} */({
        msaa: true,
        outline: true,
    });

    msaa = { samples: 4 };

    get temporal() {
        return !!this.enabled.taa;
    }
}
