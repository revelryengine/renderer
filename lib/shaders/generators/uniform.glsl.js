function uniformDeclaration({ glsl, name, count = 1 }){
    return `${glsl} ${name}${count > 1 ? `[${count}]`: ''};`;
}
function structDeclaration ({ type, layout: { uniforms } }){ 
    return `struct ${type} {\n${uniforms.map(uniformDeclaration).join(`\n`)}\n};`;
}

export function generate(ubo, group, binding) {
    const { name, layout      } = ubo;
    const { structs, uniforms } = layout;
    
    const code = /* glsl */`
        ${structs.map(structDeclaration).join('\n')}

        layout(std140) uniform ${name} {
        ${uniforms.map(uniformDeclaration).join('\n')}
        } ${name.toLowerCase()};
        #pragma revUniformBinding(${name}, ${group}, ${binding})
    `;

    return code;
}

export default generate;