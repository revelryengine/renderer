import { UBO } from '../../ubo.js';
import { RenderPathSettings } from '../render-path-settings.js';

export class QuerySettings extends RenderPathSettings {
    values = new (UBO.Layout({
        point:  { type: 'vec2<f32>' },
        min:    { type: 'vec2<f32>' },
        max:    { type: 'vec2<f32>' },
    }))(this.gal)

    flags = {
        mode: /** @type {'point'|'bounds'} */('point'),
    }
}
