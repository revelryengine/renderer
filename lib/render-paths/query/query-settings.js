import { UBO } from '../../ubo.js';
import { RenderPathSettings } from '../render-path-settings.js';

export class QuerySettings extends RenderPathSettings {
    values = new (UBO.Layout({
        query: { type: 'f32' },
    }))(this.gal)
}
