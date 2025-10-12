import { quat } from '../../../deps/gl-matrix.js';
import { UBO  } from '../../ubo.js';
import { RenderPathSettings } from '../render-path-settings.js';

export class PreviewSettings extends RenderPathSettings {
    values = new(UBO.Layout({
        grid: { type: 'Grid', layout: {
            colors: { type: 'GridColors', layout: {
                thick: { type: 'vec4<f32>' },
                thin:  { type: 'vec4<f32>' },
            }},
            increment:   { type: 'f32'       },
            orientation: { type: 'vec4<f32>' },
        } },
        depthHint: { type: 'DepthHint', layout: {
            factor: { type: 'f32'  },
        } },
    }, {
        grid: { increment: 0.1, colors: { thick: [1, 1, 1, 0.25], thin: [1, 1, 1, 0.1] }, orientation: quat.create() },
        depthHint: { factor: 0 },
    }))(this.gal);

    flags = {
        msaa:         4,
        taa:          false,
        grid:         false,
        outline:      true,

        get temporal() {
            return this.taa;
        },

        get jitter() {
            return this.taa;
        }
    }
}
