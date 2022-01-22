import { LightingUBO } from '../lighting.js';

const glsl = String.raw; // For syntax-highlighting
export const lighting = glsl`
/********** lighting.glsl.js **********/
#ifdef USE_PUNCTUAL
${LightingUBO.getShaderSource()}
#endif
/********** /lighting.glsl.js **********/
`;

export default lighting;