// Keep application-defined types and declaration annotations through the
// shared representation. Framework-specific rewrites can inspect the same
// annotation expressions as calls in the body.
// Map a source type spelling to a meta type.
export function sourceType(spelling) {
  const words = spelling
    .replace(/\b(const|static|unsigned|signed|mut)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (
    /^(int|long|short|i8|i16|i32|i64|isize|u8|u16|u32|u64|usize|Int|Long|number|integer)$/.test(
      words
    )
  ) {
    return 'integer';
  }
  if (
    /^(char ?\*|std ?:: ?string|string|String|& ?str|&'static str)$/.test(words)
  ) {
    return 'text';
  }
  if (
    /^((int|long|Long|number|i64) ?\[ ?\]|std ?:: ?vector ?< ?int ?>|Vec ?< ?i64 ?>|IntArray|\[ ?\] ?int|\[ ?Int ?\]|List ?< ?(int|Long) ?>|Array ?\[ ?Long ?\]|seq ?\[ ?int ?\]|\[ ?(\d+ ?)?\] ?i64)$/.test(
      words
    )
  ) {
    return 'array';
  }
  if (
    /^(double|float|f32|f64|float32|float64|Double|Float|Float64|Long_Float|real|Real)$/.test(
      words
    )
  ) {
    return 'real';
  }
  if (/^(bool|boolean|Bool|Boolean|BOOL)$/.test(words)) {
    return 'boolean';
  }
  if (/^(void|\(\)|Unit|Void)$/.test(words)) {
    return 'nothing';
  }
  if (words === '' || words === 'var' || words === 'auto') {
    return undefined;
  }
  return `source:${words}`;
}

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
