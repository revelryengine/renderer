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
        { name: 'ssao', type: 'ssao', layout: [
            { name: 'radius', type: 'f32' },
            { name: 'bias',   type: 'f32' },
        ] },
        { name: 'lens', type: 'Lens', layout: [
            { name: 'size',          type: 'f32' },
            { name: 'fStop',         type: 'f32' },
            { name: 'focalLength',   type: 'f32' },
            { name: 'focalDistance', type: 'f32' },
        ] },
    ]);

    static defaults = {
        environment : { enabled: true },
        punctual    : { enabled: true },
        grid        : { enabled: false, increment: 0.1, colors: { thick: [1, 1, 1, 0.25], thin: [1, 1, 1, 0.1] } },
        fog         : { enabled: false, range: [50, 100], color: [0, 0, 0, 0] },
        ssao        : { enabled: false, radius: 0.5, bias: 0.025 },
        lens        : { enabled: false, size: 50, fStop: 1.4, focalLength: 50, focalDistance: 6500 },
    }
}

export default Settings;
