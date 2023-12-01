import { UBO } from '../../ubo.js';

export class Settings extends UBO.Layout({
    exposure: { type: 'f32' },
}, {
    exposure: 1,
}){}
