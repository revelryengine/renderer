/**
 * This shader simply samples from a texture. Useful for rendering from a framebuffer texture.
 * Should be used with simple.vert.js vertex shader.
 */
 const glsl = String.raw; // For syntax-highlighting
 export const fragmentShader = glsl`
 /********** output.frag.js **********/
 precision highp float;
 /*layout(binding = 0)*/uniform sampler2D u_OutputSampler;
 in vec2 v_TexCoord;
 out vec4 g_finalColor;
 void main(void) {    
     g_finalColor = texture(u_OutputSampler, v_TexCoord);
 }
 /********** output.frag.js **********/
 `;
 
 export default fragmentShader;