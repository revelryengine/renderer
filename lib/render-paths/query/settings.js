import { UBO } from '../../ubo.js';

export class Settings extends UBO {
    static layout = new UBO.Layout([
        { name: 'exposure',  type: 'f32' },
    ]);

    static defaults = {
        exposure: 1,
    }
}

export default Settings;
