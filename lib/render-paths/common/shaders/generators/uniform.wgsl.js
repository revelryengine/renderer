/**
 * @param {{ type: string, name: string, size: number, align: number, count?: number }} declaration
 */
function uniformDeclaration({ type, name, size, align, count = 1 }) {
    return `@size(${size * count}) @align(${align}) ${name}: ${count > 1 ? `array<${type}, ${count}>`: type},`
}

/**
 * @param {{ type: string, layout: import('../../../../ubo.js').UBO['layout'] }} declaration
 */
function structDeclaration({ type, layout: { uniforms } }) {
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

    const code = /* wgsl */`
        ${structs.map(structDeclaration).join('\n')}

        struct ${name} {
        ${uniforms.map(uniformDeclaration).join(`\n`)}
        };
        @group(${group})  @binding(${binding}) var<uniform> ${name.toLowerCase()}: ${name};
    `;

    return code;
}

export default generate;
