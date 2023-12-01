import { UBO } from '../../ubo.js';

export class Settings extends UBO.Layout({
    grid: { type: 'Grid', layout: {
        colors: { type: 'GridColors', layout: {
            thick: { type: 'vec4<f32>' },
            thin:  { type: 'vec4<f32>' },
        }},
        increment: { type: 'f32' },
    } },
    wireframe: { type: 'Wireframe', layout: {
        color: { type: 'vec4<f32>' },
        width: { type: 'f32'       },
    } },
}, {
    grid: { increment: 0.1, colors: { thick: [1, 1, 1, 0.25], thin: [1, 1, 1, 0.1] } },
    wireframe: { color: [0.1, 0.1, 0.1, 1], width: 0.5 },
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
