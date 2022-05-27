function uniformDeclaration({ type, name, size, align, count = 1 }) {
    return `@size(${size * count}) @align(${align}) ${name}: ${count > 1 ? `array<${type}, ${count}>`: type};`
}
function structDeclaration({ type, layout: { uniforms } }) {
    return `struct ${type} {\n${uniforms.map(uniformDeclaration).join(`\n`)}\n};`;
}

export function generate(ubo, group, binding) {
    const { name, layout      } = ubo;
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