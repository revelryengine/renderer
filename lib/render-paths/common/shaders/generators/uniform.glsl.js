/**
 * @param {{ glsl: string, name: string, count?: number }} declaration
 */
function uniformDeclaration({ glsl, name, count = 1 }){
    return `${glsl} ${name}${count > 1 ? `[${count}]`: ''};`;
}

/**
 * @param {{ type: string, layout: import('../../../../ubo.js').UBO['layout'] }} declaration
 */
function structDeclaration ({ type, layout: { uniforms } }){
    return `struct ${type} {\n${uniforms.map(uniformDeclaration).join(`\n`)}\n};`;
}

/**
 * @param {import('../../../../ubo.js').UBO} ubo
 * @param {number} group
 * @param {number} binding
 * @param {string} [name]
 */
export function generate(ubo, group, binding, name = ubo.name) {
    const { layout } = ubo;
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
