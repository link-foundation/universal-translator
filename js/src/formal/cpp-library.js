import { inheritOrigin } from '../translation/source-origins.js';
import { node, text } from '../meta/tree.js';
import { SyntaxError } from './lexer.js';

const cppStringReferences = new Set([
  'source:std :: string &',
  'source:const std :: string &',
]);

function cppStringValue(value) {
  return (
    (value.type === 'text' && value.kind !== 'Text') ||
    cppStringReferences.has(value.type)
  );
}

function cppCharacterValue(value) {
  return (
    value.kind === 'CppCharacter' ||
    (value.kind === 'CppIntegralCast' && value.castType === 'char') ||
    value.type === 'source:char' ||
    (value.kind === 'Index' && cppStringValue(value.array))
  );
}

export function isCppCharacterConcat(left, right) {
  return (
    (cppCharacterValue(left) && cppStringValue(right)) ||
    (cppStringValue(left) && cppCharacterValue(right))
  );
}

export function isCppFixedArray(parser) {
  if (parser.syntax.id !== 'cpp') {
    return false;
  }
  let start = 0;
  while (['const', 'static'].includes(parser.peek(start).value)) {
    start += 1;
  }
  return ['std', '::', 'array', '<'].every((word, index) =>
    parser.is(word, start + index)
  );
}

export function isCppTemplateDeclaration(syntax, words) {
  return syntax.id === 'cpp' && words.includes('<');
}

export function cppListInitializer(parser, head) {
  return (
    parser.syntax.id === 'cpp' &&
    parser.is('{', head) &&
    Array.from(
      { length: head },
      (_, index) => parser.peek(index).value
    ).includes('<')
  );
}

export function readCppInitializerList(parser, direct = false) {
  parser.expect('{');
  const elements = parser.elementList('}', () =>
    parser.is('{') ? readCppInitializerList(parser) : parser.expression()
  );
  return node('CppInitializerList', { elements, direct });
}

function afterCppLineEnds(parser, offset) {
  do {
    offset += 1;
  } while (parser.peek(offset).type === 'newline');
  return offset;
}

export function withCppValueScope(parser, names, read) {
  if (parser.syntax.id !== 'cpp') {
    return read();
  }
  const scope = new Map(names.map((name) => [name, true]));
  parser.cppValueScopes.push(scope);
  try {
    return read(scope);
  } finally {
    parser.cppValueScopes.pop();
  }
}

export function recordCppBinding(scope, item) {
  if (!scope) {
    return;
  }
  if (['Declaration', 'Function', 'Class'].includes(item.kind)) {
    scope.set(
      item.name,
      item.kind !== 'Class' && !item.type?.startsWith('source:typedef ')
    );
  }
  if (item.kind === 'Import') {
    const alias = /^using\s+([\p{ID_Start}_][\p{ID_Continue}]*)\s+=/u.exec(
      item.text
    );
    if (alias) {
      scope.set(alias[1], false);
    }
  }
}

function cppKnownValue(parser, name) {
  return (
    parser.cppValueScopes.findLast((scope) => scope.has(name))?.get(name) ??
    false
  );
}

// A literal, a member access or a bound value cannot be a parameter type.
export function cppFirstArgumentIsExpression(parser, head) {
  if (parser.syntax.id !== 'cpp' || !parser.is('(', head)) {
    return false;
  }
  const argument = afterCppLineEnds(parser, head);
  const { type, value } = parser.peek(argument);
  return (
    ['number', 'text'].includes(type) ||
    (type === 'name' &&
      (['true', 'false', 'nullptr'].includes(value) ||
        cppKnownValue(parser, value) ||
        parser.is('.', afterCppLineEnds(parser, argument))))
  );
}

export function cppDirectInitializer(parser, head) {
  if (parser.syntax.id !== 'cpp' || head < 2) {
    return false;
  }
  const typeEnd = parser.peek(head - 2);
  return (
    parser.peek(head - 1).type === 'name' &&
    (typeEnd.type === 'name' || ['>', '>>'].includes(typeEnd.value)) &&
    !cppKnownValue(parser, parser.peek().value) &&
    cppFirstArgumentIsExpression(parser, head) &&
    parser.is(';', parser.afterParentheses(head))
  );
}

export function readCppDirectInitializer(parser) {
  parser.expect('(');
  const arguments_ = parser.elementList(')', () => {
    const literal = parser.peek();
    const after = parser.peek(afterCppLineEnds(parser, 0));
    const argument = parser.expression();
    if (
      literal.type === 'text' &&
      literal.quote === '"' &&
      after.type === 'symbol' &&
      [',', ')'].includes(after.value)
    ) {
      return inheritOrigin(
        node('CppStringLiteral', { raw: literal.value }),
        argument
      );
    }
    return argument;
  });
  return node('CppDirectInitializer', { arguments: arguments_ });
}

// A string literal or a count followed by a character literal disambiguates
// an object declaration from a function prototype.
export function cppStringInitializer(parser, head) {
  if (
    parser.syntax.id !== 'cpp' ||
    head !== 4 ||
    !['std', '::', 'string'].every((token, offset) =>
      parser.is(token, offset)
    ) ||
    parser.peek(3).type !== 'name' ||
    !parser.is('(', head)
  ) {
    return false;
  }
  const next = (offset) => afterCppLineEnds(parser, offset);
  const argument = next(head);
  const first = parser.peek(argument);
  if (first.type === 'text' && first.quote === '"') {
    return parser.is(')', next(argument));
  }
  const comma = next(argument);
  if (!['number', 'name'].includes(first.type) || !parser.is(',', comma)) {
    return false;
  }
  const character = next(comma);
  const second = parser.peek(character);
  return (
    second.type === 'text' &&
    second.quote === "'" &&
    parser.is(')', next(character))
  );
}

export function readCppStringInitializer(parser) {
  parser.expect('(');
  parser.skipLineEnds();
  const literal = parser.peek();
  if (literal.quote !== '"') {
    return node('Call', {
      callee: 'std::string',
      arguments: parser.elementList(')'),
    });
  }
  if (!/^(?:[^\\\r\n]|\\(?:[nrt?"'\\]|0(?![0-7])))*$/u.test(literal.value)) {
    throw new SyntaxError(
      'Unsupported C++ string initializer escape',
      literal.line
    );
  }
  const value = parser.expression();
  // The selected constructor takes a null-terminated character pointer.
  value.value = value.value.split('\0', 1)[0];
  parser.skipLineEnds();
  parser.expect(')');
  return value;
}

export function defaultCppString(syntax, words) {
  if (
    syntax.id === 'cpp' &&
    ['std :: string', 'string'].includes(words.join(' '))
  ) {
    return text('');
  }
  return undefined;
}

// An explicit C++ type template-id can precede the call's value arguments.
// A fundamental type has no expression reading, so it distinguishes this
// subset from comparisons such as `left < middle > (right)`.
const fundamental = new Set([
  'bool',
  'char',
  'char8_t',
  'char16_t',
  'char32_t',
  'double',
  'float',
  'int',
  'long',
  'short',
  'signed',
  'unsigned',
  'void',
  'wchar_t',
]);
const angleDepth = new Map([
  ['<', 1],
  ['>', -1],
  ['>>', -2],
]);

export function cppTemplateArguments(parser, callee) {
  if (
    parser.syntax.id !== 'cpp' ||
    !['Name', 'Method'].includes(callee.kind) ||
    !parser.is('<')
  ) {
    return undefined;
  }
  const indexed = callee.name === 'std::get' && scanIndexArgument(parser);
  const found = indexed || scanTypeArguments(parser);
  if (found) {
    parser.position += found.width;
  }
  return found?.types;
}

function scanIndexArgument(parser) {
  let offset = 1;
  while (parser.peek(offset).type === 'newline') {
    offset += 1;
  }
  const index = parser.peek(offset);
  if (index.type !== 'number' || !/^[0-9]+$/u.test(index.value)) {
    return undefined;
  }
  offset += 1;
  while (parser.peek(offset).type === 'newline') {
    offset += 1;
  }
  if (parser.is('>', offset) && parser.is('(', offset + 1)) {
    return { types: index.value, width: offset + 1 };
  }
  return undefined;
}

function scanTypeArguments(parser) {
  const tokens = [];
  let depth = 1;
  let needsType = true;
  let definite = false;
  for (let offset = 1; ; offset += 1) {
    const { type, value } = parser.peek(offset);
    if (type === 'newline') {
      continue;
    }
    const change = angleDepth.get(value) ?? 0;
    if (type === 'name') {
      needsType = false;
      definite ||= fundamental.has(value);
    } else if (value === '::') {
      needsType = true;
    } else if (needsType) {
      return undefined;
    } else if (value === ',' || change === 1) {
      needsType = true;
    } else if (!change && !['*', '&', '&&'].includes(value)) {
      return undefined;
    }
    depth += change;
    if (depth <= 0) {
      return finishTypeArguments(parser, tokens, {
        depth,
        definite,
        offset,
        value,
      });
    }
    tokens.push(value);
  }
}

function finishTypeArguments(
  parser,
  tokens,
  { depth, definite, offset, value }
) {
  if (depth !== 0 || !definite || !parser.is('(', offset + 1)) {
    return undefined;
  }
  if (value === '>>') {
    tokens.push('>');
  }
  return { types: tokens.join(' '), width: offset + 1 };
}

export function declarationTypeFields(syntax, words, type, value) {
  if (
    !isCppTemplateDeclaration(syntax, words) ||
    (value &&
      value.kind !== 'CppInitializerList' &&
      !type?.startsWith('source:'))
  ) {
    return { type };
  }
  return { type: `source:${words.join(' ')}`, cppTemplateType: true };
}

export function cppUsingStatement(text) {
  if (
    /^using (?:namespace [\p{L}\p{N}_]+|[\p{L}\p{N}_]+::[\p{L}\p{N}_]+)(?:::[\p{L}\p{N}_]+)*$/u.test(
      text
    )
  ) {
    return `${text};`;
  }
  return undefined;
}

export const withCppLibrary = (Base) =>
  class extends Base {
    specialExpression(expression, parent) {
      switch (expression.kind) {
        case 'CppCharacter':
          return `'${expression.raw}'`;
        case 'CppStringLiteral':
          return `"${expression.raw}"`;
        case 'CppIntegralCast':
          return `(${expression.castType})(${this.expression(expression.operand)})`;
        case 'CppCharacterConcat':
          return this.binary(expression, parent);
        case 'CppInitializerList':
          return `{${expression.elements.map((value) => this.expression(value)).join(', ')}}`;
        default:
          return super.specialExpression(expression);
      }
    }

    statement(statement) {
      if (statement.kind === 'Import') {
        const using = cppUsingStatement(statement.text);
        if (using) {
          return this.line(using);
        }
      }
      return super.statement(statement);
    }
  };

export function cppQualifiedParameter(syntax, words) {
  if (syntax.id !== 'cpp') {
    return undefined;
  }
  const explicitInteger = words.some((word) =>
    ['signed', 'unsigned', 'short', 'long'].includes(word)
  );
  const constIndirection =
    words.includes('const') &&
    words.some((word) => ['&', '&&', '*'].includes(word));
  return explicitInteger || constIndirection
    ? `source:${words.join(' ')}`
    : undefined;
}

const nativeInclude =
  /^#[ \t]*include[ \t]*(<[^>\r\n]+>|"[^"\r\n]+")([ \t]*(?:\/\/[^\r\n]*|\/\*[^\r\n]*\*\/))?$/u;

export function nativeImportKey(line) {
  return nativeInclude.exec(line)?.[1] ?? line;
}

// Literal headers and C++ using-declarations provide names for native calls.
function keepNativeImports(program, { from, to }) {
  if (from !== to || !['c', 'cpp'].includes(to) || !program.imports?.length) {
    return program;
  }
  const imports = program.imports.flatMap((line) => {
    const include = nativeInclude.exec(line);
    if (include) {
      return [`#include ${include[1]}${include[2] ?? ''}`];
    }
    const using = to === 'cpp' && cppUsingStatement(line);
    return using ? [using] : [];
  });
  const imported = new Set(imports.map(nativeImportKey));
  return imports.length
    ? {
        ...program,
        libraryImports: [
          ...imports,
          ...(program.libraryImports ?? []).filter(
            (line) => !imported.has(nativeImportKey(line))
          ),
        ],
      }
    : program;
}

export function markCppFileItems(items) {
  if (!items.some(({ kind }) => kind === 'Declaration')) {
    return items;
  }
  let order = 0;
  return items.map((item) => {
    if (
      item.kind !== 'Declaration' &&
      (item.kind !== 'Function' || item.name === 'main')
    ) {
      return item;
    }
    const marked = inheritOrigin({ ...item, cppFileOrder: order }, item);
    order += 1;
    return marked;
  });
}

function keepCppFileScope(program, { from, to }) {
  if (from !== 'cpp' || to !== 'cpp' || !program.main) {
    return program;
  }
  const declarations = [];
  const statements = [];
  for (const item of program.main.statements) {
    const scope = item.cppFileOrder === undefined ? statements : declarations;
    scope.push(item);
  }
  return declarations.length
    ? inheritOrigin(
        {
          ...program,
          globalDeclarations: declarations,
          main: inheritOrigin({ ...program.main, statements }, program.main),
        },
        program
      )
    : program;
}

export function adaptNativeCProgram(program, settings) {
  return keepCppFileScope(keepNativeImports(program, settings), settings);
}

export function cppFileItems(program) {
  const declarations = program.globalDeclarations;
  if (!declarations?.length) {
    return program.functions;
  }
  const order = (item) => item.cppFileOrder ?? Number.MAX_SAFE_INTEGER;
  return [...declarations, ...program.functions].sort(
    (a, b) => order(a) - order(b)
  );
}
