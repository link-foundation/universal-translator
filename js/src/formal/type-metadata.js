// Keep application-defined types and declaration annotations through the
// shared representation. Framework-specific rewrites can inspect the same
// annotation expressions as calls in the body.
export function namedType(type, target) {
  const name = type
    .slice('source:'.length)
    .replace(/\s*([<>,[\]*.:])\s*/g, '$1');
  if (['python', 'scala', 'go'].includes(target)) {
    return name.replaceAll('<', '[').replaceAll('>', ']');
  }
  const brackets = [];
  return [...name]
    .map((char, index) => {
      if (char === '[') {
        const generic = name[index + 1] !== ']';
        brackets.push(generic);
        return generic ? '<' : '[';
      }
      return char === ']' && brackets.pop() ? '>' : char;
    })
    .join('');
}

export const withTypeMetadata = (Base) =>
  class extends Base {
    metadataType(kind) {
      return this.id === 'python' && !kind?.startsWith('source:')
        ? ({
            integer: 'int',
            text: 'str',
            boolean: 'bool',
            nothing: 'None',
            real: 'float',
            array: 'list[int]',
          }[kind] ?? 'object')
        : this.type(kind);
    }

    signature(item) {
      const annotations = (parameter) =>
        (parameter.annotations ?? []).map((value) =>
          this.expression(value.expression)
        );
      const hasMetadata =
        item.annotations?.length ||
        item.returnType?.startsWith('source:') ||
        item.parameters.some(
          (value) =>
            value.annotations?.length || value.type?.startsWith('source:')
        );
      if (!hasMetadata) {
        return super.signature(item);
      }
      if (this.id === 'python') {
        const parameters = item.parameters.map((parameter) => {
          let type = this.metadataType(parameter.type);
          const metadata = annotations(parameter);
          if (metadata.length) {
            this.uses.add('typing');
            type = `Annotated[${type}, ${metadata.join(', ')}]`;
          }
          return `${parameter.name}: ${this.quote(type)}`;
        });
        return `def ${item.name}(${parameters.join(', ')}) -> ${this.quote(this.metadataType(item.returnType))}`;
      }
      if (['java', 'kotlin'].includes(this.id)) {
        const parameters = item.parameters.map((parameter) => {
          const prefix = annotations(parameter)
            .map((value) => `@${value} `)
            .join('');
          const type = this.type(parameter.type);
          return `${prefix}${this.id === 'java' ? `${type} ${parameter.name}` : `${parameter.name}: ${type}`}`;
        });
        const returns = this.type(item.returnType);
        return this.id === 'java'
          ? `static ${returns} ${item.name}(${parameters.join(', ')})`
          : `fun ${item.name}(${parameters.join(', ')}): ${returns}`;
      }
      if (
        item.annotations?.length ||
        item.parameters.some((parameter) => parameter.annotations?.length)
      ) {
        throw new Error(`Annotations need a framework mapping for ${this.id}`);
      }
      return super.signature(item);
    }
  };
