import { quat } from '../../../deps/gl-matrix.js';
import { UBO  } from '../../ubo.js';
import { RenderPathSettings } from '../render-path-settings.js';

export class StandardSettings extends RenderPathSettings {
    values = new (class extends UBO.Layout({
        grid: { type: 'Grid', layout: {
            colors: { type: 'GridColors', layout: {
                thick: { type: 'vec4<f32>' },
                thin:  { type: 'vec4<f32>' },
            }},
            increment:   { type: 'f32'       },
            orientation: { type: 'vec4<f32>' },
        } },
        exposure: { type: 'f32' },
        shadows:  { type: 'shadows', layout: {
            cascades: { type: 'f32' },
            lambda:   { type: 'f32' },
        } },
        fog: { type: 'Fog', layout: {
            range: { type: 'vec2<f32>' },
            color: { type: 'vec4<f32>' },
        } },
        ssao: { type: 'ssao', layout: {
            radius: { type: 'f32' },
            bias:   { type: 'f32' },
        } },
        lens: { type: 'Lens', layout: {
            size:          { type: 'f32' },
            fStop:         { type: 'f32' },
            focalLength:   { type: 'f32' },
            focalDistance: { type: 'f32' },
        } },
        bloom: { type: 'Bloom', layout: {
            threshold:     { type: 'f32' },
            intensity:     { type: 'f32' },
            softThreshold: { type: 'f32' },
            knee:          { type: 'vec4<f32>' },
        } },
        motionBlur: { type: 'MotionBlur', layout: {
            scale: { type: 'f32' },
        } },
        skybox: { type: 'skybox', layout: {
            blur: { type: 'f32' },
        } },
        volume: { type: 'f32' },
    }, {
        exposure     : 1,
        shadows      : { cascades: 3, lambda: 0.5 },
        grid         : { increment: 0.1, colors: { thick: [1, 1, 1, 0.25], thin: [1, 1, 1, 0.1] }, orientation: quat.create() },
        fog          : { range: [50, 100], color: [0, 0, 0, 0] },
        ssao         : { radius: 0.5, bias: 0.025 },
        lens         : { size: 50, fStop: 1.4, focalLength: 50, focalDistance: 6500 },
        bloom        : { threshold: 1, intensity: 1, softThreshold: 0.5 },
        motionBlur   : { scale: 1.0 },
        skybox       : { blur: 0 },
        volume       : 1,
    }){
        upload() {
            // Precompute bloom knee filter
            const knee = this.bloom.threshold * this.bloom.softThreshold;
            this.bloom.knee.set(new Float32Array([
                this.bloom.threshold,
                this.bloom.threshold - knee,
                2 * knee,
                0.25 / (knee + 0.00001),
            ]));
            super.upload();
        }
    })(this.gal);

    flags = {
        msaa:         4,
        taa:          false,
        grid:         false,
        outline:      true,


        environment:  true,
        punctual:     true,
        transmission: true,
        shadows:      true,

        fog:          false,
        ssao:         false,
        lens:         false,
        bloom:        false,
        motionBlur:   false,
        skybox:       false,
        passiveInput: false,


        alphaBlendMode: /** @type {'ordered'|'weighted'} */('ordered'),
        tonemap:        /** @type {typeof import('../../constants.js').PBR_TONEMAPS[number]|null}*/(null),
        debugPBR:       /** @type {keyof typeof import('../../constants.js').PBR_DEBUG_MODES | 'None'} */('None'),
        debugAABB:      false,

        audio: true,

        maxLights: 12,
        maxShadows: 6,

        get temporal() {
            return !!(this.motionBlur || this.taa);
        },

        get jitter() {
            return this.taa;
        }
    }
}
