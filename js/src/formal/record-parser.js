import { node } from '../meta/tree.js';
import {
  attachComments,
  inheritOrigin,
} from '../translation/source-origins.js';
import { SyntaxError } from './lexer.js';
import { supportsRecords, validRecord } from './record-model.js';

function skipLines(parser) {
  while (parser.peek().type === 'newline') {
    parser.next();
  }
}

function recordError(parser, message) {
  return new SyntaxError(message, parser.peek().line);
}

function record(parser, name, parameters, fields, comments) {
  const definition = node('RecordDefinition', { name, parameters, fields });
  if (!validRecord(definition)) {
    throw recordError(
      parser,
      'A record requires one field per distinct constructor parameter'
    );
  }
  return comments.length
    ? attachComments(definition, 'constructorComments', comments)
    : definition;
}

export function isNamespaceOrClass(parser, modifiers) {
  let offset = 0;
  while (modifiers.has(parser.peek(offset).value)) {
    offset += 1;
  }
  const token = parser.peek(offset);
  return (
    token.type === 'name' &&
    ['class', 'namespace', 'object'].includes(token.value)
  );
}

export function readClass(parser, modifiers) {
  const start = parser.position;
  while (modifiers.has(parser.peek().value)) {
    parser.next();
  }
  const modified = parser.position !== start;
  const kind = parser.next().value;
  const name = parser.expectName();
  if (
    parser.syntax.id === 'scala' &&
    parser.is('extends') &&
    parser.is('App', 1)
  ) {
    parser.position += 2;
  }
  skipLines(parser);
  parser.expect('{');
  if (
    parser.syntax.id === 'javascript' &&
    kind === 'class' &&
    jsRecordStarts(parser)
  ) {
    if (!supportsRecords(parser.syntax)) {
      throw recordError(parser, 'Class declarations require ECMAScript 2015');
    }
    if (modified || parser.classDepth) {
      throw recordError(
        parser,
        'A record class must be an unmodified top-level declaration'
      );
    }
    return readJsRecord(parser, name);
  }
  parser.classDepth = (parser.classDepth ?? 0) + 1;
  try {
    const items = parser.items(() => parser.is('}'));
    parser.expect('}');
    return node('Class', { form: kind, name, items });
  } finally {
    parser.classDepth -= 1;
  }
}

function jsRecordStarts(parser) {
  let offset = 0;
  while (['newline', 'comment'].includes(parser.peek(offset).type)) {
    offset += 1;
  }
  return parser.is('constructor', offset) && parser.is('(', offset + 1);
}

function readJsRecord(parser, name) {
  parser.skipSeparators();
  const comments = [];
  while (parser.peek().type === 'comment') {
    comments.push(parser.item());
    parser.skipSeparators();
  }
  parser.expect('constructor');
  const parameters = commaList(parser, '(', ')', () => parser.expectName());
  const { statements } = parser.block();
  const fields = statements
    .filter(({ kind }) => kind !== 'Blank')
    .map((statement) => {
      if (
        statement.kind !== 'PropertyAssignment' ||
        statement.object.kind !== 'Name' ||
        statement.object.name !== 'this' ||
        statement.value.kind !== 'Name'
      ) {
        throw recordError(
          parser,
          'Expected an assignment from a parameter to an instance field'
        );
      }
      return inheritOrigin(
        node('RecordField', {
          name: statement.property,
          parameter: statement.value.name,
        }),
        statement
      );
    });
  parser.skipSeparators();
  parser.expect('}');
  return record(parser, name, parameters, fields, comments);
}

function commaList(parser, open, close, item) {
  skipLines(parser);
  parser.expect(open);
  const items = [];
  skipLines(parser);
  while (!parser.is(close)) {
    items.push(item());
    skipLines(parser);
    if (!parser.accept(',')) {
      break;
    }
    skipLines(parser);
  }
  parser.expect(close);
  return items;
}

function genericNames(parser) {
  return parser.is('<')
    ? commaList(parser, '<', '>', () => parser.expectName())
    : [];
}

function namedEntries(parser, open, close, { prefix, shorthand } = {}) {
  return commaList(parser, open, close, () => {
    if (prefix) {
      parser.expect(prefix);
    }
    const key = parser.expectName();
    if (parser.accept(':')) {
      return [key, parser.expectName()];
    }
    if (shorthand) {
      return [key, key];
    }
    throw recordError(parser, 'Expected a record field type');
  });
}

export function readRustRecord(parser) {
  parser.expect('pub');
  parser.expect('struct');
  const name = parser.expectName();
  const types = genericNames(parser);
  const declarations = namedEntries(parser, '{', '}', { prefix: 'pub' });
  parser.skipSeparators();
  parser.expect('impl');
  const implementationTypes = genericNames(parser);
  parser.expect(name);
  const argumentsToType = genericNames(parser);
  skipLines(parser);
  parser.expect('{');
  parser.skipSeparators();
  const comments = [];
  while (parser.peek().type === 'comment') {
    comments.push(parser.item());
    parser.skipSeparators();
  }
  parser.expect('pub');
  parser.expect('fn');
  parser.expect('new');
  const parameters = namedEntries(parser, '(', ')');
  parser.expect('->');
  parser.expect('Self');
  skipLines(parser);
  parser.expect('{');
  parser.skipSeparators();
  parser.expect('Self');
  const initializers = namedEntries(parser, '{', '}', { shorthand: true });
  skipLines(parser);
  parser.expect('}');
  parser.skipSeparators();
  parser.expect('}');

  const declaredTypes = new Map(
    types.map((type, index) => [type, argumentsToType[index]])
  );
  const fieldTypes = new Map(declarations);
  const parameterTypes = new Map(parameters);
  if (
    argumentsToType.length !== types.length ||
    implementationTypes.length !== types.length ||
    new Set(types).size !== types.length ||
    new Set(argumentsToType).size !== types.length ||
    !argumentsToType.every((type) => implementationTypes.includes(type)) ||
    parameters.length !== types.length ||
    new Set(parameterTypes.values()).size !== types.length ||
    declarations.length !== initializers.length ||
    declarations.length !== fieldTypes.size ||
    initializers.some(([key, parameter]) => {
      const actual = declaredTypes.get(fieldTypes.get(key));
      return actual === undefined || actual !== parameterTypes.get(parameter);
    })
  ) {
    throw recordError(
      parser,
      'A record constructor requires one generic type per field'
    );
  }
  const fields = initializers.map(([name, parameter]) =>
    node('RecordField', { name, parameter })
  );
  return record(
    parser,
    name,
    parameters.map(([parameter]) => parameter),
    fields,
    comments
  );
}
