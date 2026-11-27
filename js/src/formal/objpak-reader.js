// Recognize an embedded, verified library definition independently of its
// caller. An unmatched definition follows the ordinary parser. The concrete
// source record retains every byte.
import { objpakRuntime } from './objpak-runtime.js';
import { node, name } from '../meta/tree.js';
import { byteOffsets } from '../translation/source-spans.js';
import { tokenize } from './lexer.js';

function libraryTokens(source, syntax) {
  if (['javascript', 'typescript'].includes(syntax.id)) {
    source = source.replace(/[\u2028\u2029]/gu, '\n');
  }
  return tokenize(source, {
    ...syntax,
    symbols: ['>>>', '^', '~', ...(syntax.symbols ?? [])],
  }).filter(
    (token) =>
      token.type !== 'end' &&
      !(
        ['javascript', 'typescript'].includes(syntax.id) &&
        token.type === 'comment'
      ) &&
      (syntax.blocks === 'indentation' || token.type !== 'newline')
  );
}

function libraryTokenValue(token, previous, language) {
  const significantBreak =
    ['javascript', 'typescript'].includes(language) &&
    previous &&
    (['return', 'throw', 'break', 'continue', 'yield'].includes(
      previous.value
    ) ||
      ['++', '--'].includes(token.value));
  return JSON.stringify([
    token.type,
    ['indent', 'dedent'].includes(token.type) ? '' : token.value,
    token.quote,
    token.style,
    significantBreak ? previous.line !== token.line : false,
    ['name', 'number'].includes(token.type) &&
    ['name', 'number'].includes(previous?.type)
      ? previous.rawSpan?.[1] === token.rawSpan?.[0]
      : false,
  ]);
}

export function libraryEnd(source, start, definition, syntax) {
  try {
    const expected = libraryTokens(definition, syntax);
    const actual = libraryTokens(source.slice(start), syntax).slice(
      0,
      expected.length
    );
    if (
      actual.length !== expected.length ||
      !expected.every(
        (token, index) =>
          libraryTokenValue(token, expected[index - 1], syntax.id) ===
          libraryTokenValue(actual[index], actual[index - 1], syntax.id)
      )
    ) {
      return undefined;
    }
    return start + Math.max(...actual.map((token) => token.rawSpan?.[1] ?? 0));
  } catch {
    return undefined;
  }
}

export function topLevel(source, start, syntax) {
  if (start > 0 && !['\r', '\n'].includes(source[start - 1])) {
    return false;
  }
  try {
    const tokens = tokenize(source.slice(0, start), {
      ...syntax,
      symbols: ['^', '~', ...(syntax.symbols ?? [])],
    });
    return (
      tokens
        .filter((t) => t.type === 'symbol')
        .reduce(
          (depth, t) =>
            depth + (t.value === '{' ? 1 : t.value === '}' ? -1 : 0),
          0
        ) === 0
    );
  } catch {
    return false;
  }
}

export function objpakSource(source, language, syntax) {
  const runtime = objpakRuntime[language];
  if (!runtime) {
    return { source, bindings: [], definitions: [] };
  }
  const declarations =
    language === 'objc'
      ? /id (UtObjpakSet_*)\(/gu
      : language === 'rust'
        ? /struct (UtObjpakSet_*)\b/gu
        : /class (UtObjpakSet_*)\b/gu;
  const bindings = [];
  const definitions = [];
  let masked = source;
  for (const match of source.matchAll(declarations)) {
    const definition = runtime.replaceAll('$SET$', match[1]);
    // Rust's derive attribute precedes its struct.
    const start =
      language === 'rust'
        ? match.index - '#[derive(Clone)]\n'.length
        : match.index;
    if (start < 0 || !topLevel(source, start, syntax)) {
      continue;
    }
    const end = libraryEnd(source, start, definition, syntax);
    if (end === undefined) {
      continue;
    }
    bindings.push(match[1]);
    definitions.push([start, end]);
    masked =
      masked.slice(0, start) +
      source
        .slice(start, end)
        .replace(/[^\r\n]/gu, (character) => ' '.repeat(character.length)) +
      masked.slice(end);
  }
  return { source: masked, bindings, definitions };
}

// A verified library has an opaque grammar production.
// Its concrete spelling remains available even when its contract is portable.
export function objpakConcrete(
  syntax,
  source,
  definitions,
  rule = 'objpakLibrary'
) {
  const offsets = byteOffsets(source);
  for (const [start, end] of definitions) {
    const from = offsets[start];
    const to = offsets[end];
    syntax.children = syntax.children.flatMap((child) => {
      if (child.kind !== 'Trivia' || child.start > from || child.end < to) {
        return [child];
      }
      const textStart = start - offsets.indexOf(child.start);
      return [
        ...(child.start < from
          ? [{ ...child, end: from, text: child.text.slice(0, textStart) }]
          : []),
        {
          kind: 'Token',
          type: 'library-definition',
          start: from,
          end: to,
          text: source.slice(start, end),
        },
        ...(child.end > to
          ? [
              {
                ...child,
                start: to,
                text: child.text.slice(textStart + end - start),
              },
            ]
          : []),
      ];
    });
    syntax.productions.push({
      kind: 'Production',
      rule,
      concept: 'LibraryDefinition',
      start: from,
      end: to,
    });
  }
  return syntax;
}

function pythonUpdate(parser) {
  parser.next();
  const variable = parser.expectName();
  parser.expect(':=');
  const value = parser.expression();
  parser.expect(')');
  if (
    value.kind !== 'Binary' ||
    !['add', 'subtract'].includes(value.operator) ||
    value.left.kind !== 'Name' ||
    value.left.name !== variable ||
    value.right.kind !== 'Number' ||
    value.right.value !== 1
  ) {
    throw new Error(
      'Assignment expressions currently support unit updates of their own variable'
    );
  }
  return node('Update', {
    operand: name(variable),
    delta: value.operator === 'add' ? 1 : -1,
    prefix: true,
  });
}

function rustArguments(parser) {
  for (const includeProgram of [true, false]) {
    const spelling = `std::env::args()${includeProgram ? '' : '.skip(1)'}.collect::<Vec<String>>()`;
    // The lexer keeps each qualified identifier component as a name.
    const values = spelling.match(/[A-Za-z_]+|::|>>|[().<>1]/gu);
    if (values.every((value, index) => parser.is(value, index))) {
      parser.position += values.length;
      return node('ProcessArguments', { includeProgram });
    }
  }
  return undefined;
}

function rustUpdateResult(statements, assignment, result) {
  if (result?.kind !== 'Name') {
    return false;
  }
  const first = statements[0];
  return statements.length === 2
    ? result.name === assignment.name
    : first.kind === 'Declaration' &&
        first.value.kind === 'Name' &&
        first.value.name === assignment.name &&
        result.name === first.name;
}

function rustUpdate(parser) {
  const statements = parser.block().statements;
  const assignment = statements[statements.length === 2 ? 0 : 1];
  const result = statements.at(-1)?.value;
  if (
    [2, 3].includes(statements.length) &&
    assignment?.kind === 'Assignment' &&
    ['+=', '-='].includes(assignment.operator) &&
    assignment.value.kind === 'Number' &&
    assignment.value.value === 1 &&
    rustUpdateResult(statements, assignment, result)
  ) {
    return node('Update', {
      operand: name(assignment.name),
      delta: assignment.operator === '+=' ? 1 : -1,
      prefix: statements.length === 2,
    });
  }
  throw new Error(
    'A value block currently supports only a numeric unit update'
  );
}

export const withObjpakParser = (Base) =>
  class extends Base {
    unary() {
      if (
        ['javascript', 'typescript'].includes(this.syntax.id) &&
        (this.is('++') || this.is('--'))
      ) {
        const delta = this.next().value === '++' ? 1 : -1;
        return node('Update', { operand: this.unary(), delta, prefix: true });
      }
      return super.unary();
    }
    postfix() {
      const operand = super.postfix();
      if (
        ['javascript', 'typescript'].includes(this.syntax.id) &&
        (this.is('++') || this.is('--'))
      ) {
        return node('Update', {
          operand,
          delta: this.next().value === '++' ? 1 : -1,
          prefix: false,
        });
      }
      return operand;
    }
    primary() {
      const python = this.syntax.id === 'python';
      if (python && this.is('(') && this.is(':=', 2)) {
        return pythonUpdate(this);
      }
      if (
        python &&
        ['sys', '.', 'argv', '[', '1', ':', ']'].every((value, index) =>
          this.is(value, index)
        )
      ) {
        this.position += 7;
        return node('ProcessArguments', { includeProgram: false });
      }
      if (this.syntax.id === 'rust') {
        const args = rustArguments(this);
        if (args) {
          return args;
        }
        if (this.is('{')) {
          return rustUpdate(this);
        }
      }
      return super.primary();
    }
  };
