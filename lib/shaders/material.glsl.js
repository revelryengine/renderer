import { MaterialUBO } from '../material.js';

const glsl = String.raw; // For syntax-highlighting
export const material = glsl`
/********** material.glsl.js **********/
${MaterialUBO.getShaderSource()}
/********** /material.glsl.js **********/
`;

export default material;