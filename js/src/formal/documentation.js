import { inheritOrigin } from '../translation/source-origins.js';

// CPython 3.13+ expands tabs and strips the first line's leading spaces
// and the common indentation after it. Leading/trailing blank lines stay.
export function cleanDocumentation(value) {
  const expanded = value.split('\n').map((line) => {
    let column = 0;
    return [...line]
      .map((character) => {
        const width = character === '\t' ? 8 - (column % 8) : 1;
        column = character === '\r' ? 0 : column + width;
        return character === '\t' ? ' '.repeat(width) : character;
      })
      .join('');
  });
  const widths = expanded
    .slice(1)
    .filter((line) => /[^ ]/u.test(line))
    .map((line) => /^ */u.exec(line)[0].length);
  const margin = widths.reduce(
    (minimum, width) => Math.min(minimum, width),
    widths[0] ?? 0
  );
  return expanded
    .map((line, index) => {
      const spaces = /^ */u.exec(line)[0].length;
      return line.slice(index === 0 ? spaces : Math.min(spaces, margin));
    })
    .join('\n');
}

function pythonDocumentation(item, modern) {
  if (item.kind !== 'Function') {
    return item;
  }
  const first = item.body.statements.findIndex(
    (statement) => !['Comment', 'Blank'].includes(statement.kind)
  );
  const statement = item.body.statements[first];
  if (statement?.kind !== 'Evaluate' || statement.expression.kind !== 'Text') {
    return item;
  }
  const original = statement.expression;
  const documentation = modern
    ? inheritOrigin(
        { ...original, value: cleanDocumentation(original.value) },
        original
      )
    : original;
  return inheritOrigin(
    {
      ...item,
      documentation,
      body: inheritOrigin(
        {
          ...item.body,
          statements: item.body.statements.filter((_, at) => at !== first),
        },
        item.body
      ),
    },
    item
  );
}

function adjacentDocumentation(previous, item) {
  return (
    previous?.kind === 'Function' &&
    item.kind === 'PropertyAssignment' &&
    item.property === '__doc__' &&
    item.object.kind === 'Name' &&
    item.object.name === previous.name &&
    item.value.kind === 'Text'
  );
}

export function recognizeDocumentation(source, { from } = {}) {
  const [language, version] = from?.split('@') ?? [];
  const python = language === 'python';
  if (!python && !['javascript', 'typescript'].includes(language)) {
    return source;
  }
  const [major, minor] = (version ?? '3').split('.').map(Number);
  const modern =
    !Number.isFinite(major) ||
    major > 3 ||
    (major === 3 && (!minor || minor >= 13));
  const items = [];
  for (const original of source.items) {
    const previous = items.at(-1);
    // Adjacent assignments describe the definition. Later assignments retain
    // their position because earlier reads must observe the earlier value.
    if (adjacentDocumentation(previous, original)) {
      items[items.length - 1] = inheritOrigin(
        { ...previous, documentation: original.value },
        previous
      );
    } else {
      items.push(python ? pythonDocumentation(original, modern) : original);
    }
  }
  return inheritOrigin({ ...source, items }, source);
}

export function writeDocumentationAssignment(emitter, item) {
  const documentation = item.documentation;
  if (!documentation) {
    return;
  }
  const python = emitter.id === 'python';
  const restore =
    python && cleanDocumentation(documentation.value) !== documentation.value;
  if (restore || ['javascript', 'typescript'].includes(emitter.id)) {
    const end = python ? '' : ';';
    emitter.line(
      `${emitter.variable(item.name)}.__doc__ = ${emitter.expression(documentation)}${end}`
    );
  }
}
