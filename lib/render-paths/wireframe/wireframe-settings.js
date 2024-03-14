import { quat } from '../../../deps/gl-matrix.js';
import { UBO  } from '../../ubo.js';
import { RenderPathSettings } from '../render-path-settings.js';

export class WireframeSettings extends RenderPathSettings {
    values = new(UBO.Layout({
        grid: { type: 'Grid', layout: {
            colors: { type: 'GridColors', layout: {
                thick: { type: 'vec4<f32>' },
                thin:  { type: 'vec4<f32>' },
            }},
            increment:   { type: 'f32'       },
            orientation: { type: 'vec4<f32>' },
        } },
        wireframe: { type: 'Wireframe', layout: {
            color: { type: 'vec4<f32>' },
            width: { type: 'f32'       },
        } }
    }, {
        grid: { increment: 0.1, colors: { thick: [1, 1, 1, 0.25], thin: [1, 1, 1, 0.1] }, orientation: quat.create() },
        wireframe: { color: [0.1, 0.1, 0.1, 1], width: 0.5 },
    }))(this.gal);

    flags = {
        msaa:         4,
        taa:          false,
        grid:         false,
        outline:      true,
    }

    get temporal() {
        return this.flags.taa;
    }
}
