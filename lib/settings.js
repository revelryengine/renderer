import { UBO } from './ubo.js';

export class Settings extends UBO {
    static layout = new UBO.Layout([
        { name: 'grid', type: 'Grid', layout: [
            { name: 'colors', type: 'GridColors', layout: [
                { name: 'thick', type: 'vec4<f32>' },
                { name: 'thin',  type: 'vec4<f32>' },
            ]},
            { name: 'increment',  type: 'f32' },
        ] },
        { name: 'fog', type: 'Fog', layout: [
            { name: 'range', type: 'vec2<f32>' },
            { name: 'color', type: 'vec4<f32>' },
        ] },
    ]);

    static defaults = {
        environment : { enabled: true },
        punctual    : { enabled: true },
        grid        : { enabled: false, increment: 0.1, colors: { thick: [1, 1, 1, 0.25], thin: [1, 1, 1, 0.1] } },
        fog         : { enabled: false, range: [50, 100], color: [0, 0, 0, 0] },
    }
}

export default Settings;
