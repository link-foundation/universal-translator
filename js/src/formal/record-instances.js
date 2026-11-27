import { node } from '../meta/tree.js';
import { inheritOrigin, sourceOrigin } from '../translation/source-origins.js';
import { languageSyntax } from './languages.js';
import { tokenize } from './lexer.js';
import { neutralName } from './names.js';

export function recordLiteralType(value) {
  if (value?.kind === 'Text' && typeof value.value === 'string') {
    return 'text';
  }
  if (value?.kind === 'Boolean' && typeof value.value === 'boolean') {
    return 'boolean';
  }
  if (
    value?.kind === 'Number' &&
    value.type !== 'real' &&
    Number.isInteger(value.value) &&
    value.value >= -2147483648 &&
    value.value <= 2147483647 &&
    !Object.is(value.value, -0)
  ) {
    return 'integer';
  }
  return undefined;
}

function constructorNames(definitions, rust) {
  return new Map(
    definitions.map((definition) => [
      rust ? `${definition.name}::new` : `new ${definition.name}`,
      definition,
    ])
  );
}

function checkSource(statements, rust) {
  const origin = statements.map(sourceOrigin).find(Boolean);
  if (!origin) {
    return () => false;
  }
  const bytes = new globalThis.TextEncoder().encode(origin.source);
  const mayFormat = !rust && /%|\\[xu]/u.test(origin.source);
  const decoder = new globalThis.TextDecoder();
  const syntax = languageSyntax(rust ? 'rust' : 'javascript');
  return (statement) => {
    if (['Comment', 'Blank'].includes(statement.kind)) {
      return true;
    }
    const spans = sourceOrigin(statement)?.spans;
    if (!spans?.length) {
      return false;
    }
    const written = decoder.decode(
      bytes.subarray(spans[0][0], spans.at(-1)[1])
    );
    const tokens = tokenize(written, syntax);
    if (
      tokens.some(
        ({ type, value }) =>
          type === 'text' &&
          /\\(?:x|u(?!\{))/u.test(value.replace(/\\\\/gu, ''))
      ) ||
      (rust && !preservesRustCasts(tokens))
    ) {
      return false;
    }
    return statement.kind !== 'Print' || supportsPrint(tokens, rust, mayFormat);
  };
}

function supportsPrint(tokens, rust, mayFormat) {
  if (!rust) {
    return (
      tokens
        .slice(0, 4)
        .map(({ value }) => value)
        .join('') === 'console.log(' &&
      (!mayFormat || !hasMultipleArguments(tokens.slice(4)))
    );
  }
  const [macro, open, format] = tokens;
  return (
    ['print!', 'println!'].includes(macro?.value) &&
    open?.value === '(' &&
    format?.type === 'text' &&
    !/[{}]/u.test(format.value.replace(/\{\}|\{\{|\}\}/gu, ''))
  );
}

// Node uses its first string as a format only when another argument follows.
function hasMultipleArguments(tokens) {
  let depth = 0;
  for (const { type, value } of tokens) {
    if (type !== 'symbol') {
      continue;
    }
    if (value === ',' && depth === 0) {
      return true;
    }
    if (['(', '[', '{'].includes(value)) {
      depth += 1;
    } else if ([')', ']', '}'].includes(value)) {
      depth -= 1;
    }
  }
  return false;
}

function preservesRustCasts(tokens) {
  return tokens.every(
    (token, index) =>
      token.type !== 'name' ||
      token.value !== 'as' ||
      (tokens[index - 1]?.type === 'number' &&
        tokens[index + 1]?.value === 'i64')
  );
}

// Bind and consume only scalar literals and reads in the same linear scope.
// An object cannot be aliased, mutated, captured, or passed to user code.
class RecordScope {
  constructor(definitions, rust) {
    this.constructors = constructorNames(definitions, rust);
    this.names = new Set([
      'console',
      ...definitions.map(({ name }) => neutralName(name)),
    ]);
    this.records = new Map();
    this.scalars = new Set();
    this.rust = rust;
  }

  scalar(value) {
    if (recordLiteralType(value)) {
      return value;
    }
    if (value.kind === 'Interpolation') {
      const parts = value.parts.map((part) => this.scalar(part));
      return parts.every(Boolean)
        ? inheritOrigin({ ...value, parts }, value)
        : undefined;
    }
    if (value.kind !== 'Name') {
      return undefined;
    }
    if (this.scalars.has(value.name)) {
      return value;
    }
    const [receiver, property, extra] = value.name.split('.');
    const type =
      extra === undefined && this.records.get(receiver)?.get(property);
    return type
      ? inheritOrigin(
          node('RecordFieldRead', {
            object: inheritOrigin(node('Name', { name: receiver }), value),
            property,
            type,
          }),
          value
        )
      : undefined;
  }

  construct(value, definition) {
    const definitionEnd = sourceOrigin(definition)?.spans?.at(-1)?.[1];
    const callStart = sourceOrigin(value)?.spans?.[0]?.[0];
    const types = value.arguments.map(recordLiteralType);
    if (
      (!this.rust && !(definitionEnd <= callStart)) ||
      types.length !== definition.parameters.length ||
      !types.every(Boolean)
    ) {
      return undefined;
    }
    return new Map(
      definition.fields.map(({ name, parameter }) => [
        name,
        types[definition.parameters.indexOf(parameter)],
      ])
    );
  }

  statement(statement) {
    if (statement.kind === 'Comment' || statement.kind === 'Blank') {
      return statement;
    }
    if (!statement.value) {
      return undefined;
    }
    if (statement.kind === 'Print') {
      const value = this.scalar(statement.value);
      return value && inheritOrigin({ ...statement, value }, statement);
    }
    if (
      statement.kind !== 'Declaration' ||
      statement.mutable ||
      this.names.has(neutralName(statement.name))
    ) {
      return undefined;
    }
    this.names.add(neutralName(statement.name));
    const definition =
      statement.value.kind === 'Call' &&
      this.constructors.get(statement.value.callee);
    if (!definition) {
      const value = this.scalar(statement.value);
      if (value) {
        this.scalars.add(statement.name);
        return inheritOrigin({ ...statement, value }, statement);
      }
      return undefined;
    }
    const fields = this.construct(statement.value, definition);
    if (!fields) {
      return undefined;
    }
    this.records.set(statement.name, fields);
    const value = inheritOrigin(
      node('RecordConstruction', {
        record: definition.name,
        arguments: statement.value.arguments,
      }),
      statement.value
    );
    return inheritOrigin({ ...statement, value }, statement);
  }
}

export function recognizeRecordInstances(program, { from } = {}) {
  if (!program.definitions?.length || !from) {
    return program;
  }
  const rust = languageSyntax(from).id === 'rust';
  if (
    program.definitions.some(({ name }) => !rust && name === 'console') ||
    program.imports.length ||
    program.functions.length ||
    (!rust && program.mainComments)
  ) {
    return program;
  }
  const scope = new RecordScope(program.definitions, rust);
  const original = program.main.statements;
  if (
    !original.some(
      ({ value }) =>
        value?.kind === 'Call' && scope.constructors.has(value.callee)
    )
  ) {
    return program;
  }
  const sourceAllowed = checkSource(original, rust);
  const statements = [];
  for (const statement of original) {
    const next = sourceAllowed(statement) && scope.statement(statement);
    if (!next) {
      return program;
    }
    statements.push(next);
  }
  return inheritOrigin(
    {
      ...program,
      main: inheritOrigin({ ...program.main, statements }, program.main),
    },
    program
  );
}
