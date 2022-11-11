import { UBO } from './ubo.js';

export class Settings extends UBO {
    static layout = new UBO.Layout([
        { name: 'exposure',  type: 'f32' },
        { name: 'shadows', type: 'shadows', layout: [
            { name: 'cascades', type: 'f32' },
            { name: 'lambda',   type: 'f32' },
        ] },
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
        { name: 'bloom', type: 'Bloom', layout: [
            { name: 'threshold',     type: 'f32' },
            { name: 'intensity',     type: 'f32' },
            { name: 'softThreshold', type: 'f32' },
            { name: 'knee',          type: 'vec4<f32>' },
        ] },
        { name: 'motionBlur', type: 'MotionBlur', layout: [
            { name: 'scale',     type: 'f32' },
        ] },
    ]);

    static defaults = {
        exposure     : 1,
        tonemap      : null,
        audio        : { enabled: true, volume: 1, muted: false },
        environment  : { enabled: true },
        punctual     : { enabled: true },
        transmission : { enabled: true },
        shadows      : { enabled: true,  cascades: 3, lambda: 0.5 },
        grid         : { enabled: false, increment: 0.1, colors: { thick: [1, 1, 1, 0.25], thin: [1, 1, 1, 0.1] } },
        fog          : { enabled: false, range: [50, 100], color: [0, 0, 0, 0] },
        ssao         : { enabled: false, radius: 0.5, bias: 0.025 },
        lens         : { enabled: false, size: 50, fStop: 1.4, focalLength: 50, focalDistance: 6500 },
        bloom        : { enabled: false, threshold: 1, intensity: 1, softThreshold: 0.5 },
        motionBlur   : { enabled: false, scale: 1.0 },
        msaa         : { enabled: true, samples: 4 },
        taa          : { enabled: false },
    }

    upload() {
        // Precompute bloom knee filter
        const knee = this.bloom.threshold * this.bloom.softThreshold;
        this.bloom.knee = new Float32Array([
            this.bloom.threshold,
            this.bloom.threshold - knee,
            2 * knee,
            0.25 / (knee + 0.00001),
        ]);
        super.upload();
    }

    /**
     * returns true if a setting that requires temporal motion vectors is enabled
     */
    get temporal() {
        return this.motionBlur.enabled || this.taa.enabled;
    }
}

export default Settings;
