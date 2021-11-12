import { EnvironmentUBO } from '../environment.js';

const glsl = String.raw; // For syntax-highlighting
export const environment = glsl`
/********** environment.glsl.js **********/
${EnvironmentUBO.getShaderSource()}
/********** /environment.glsl.js **********/
`;

export default environment;