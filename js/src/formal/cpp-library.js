import { inheritOrigin } from '../translation/source-origins.js';

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
  const found = scanTypeArguments(parser);
  if (found) {
    parser.position += found.width;
  }
  return found?.types;
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
    syntax.id !== 'cpp' ||
    !words.includes('<') ||
    (value && !type?.startsWith('source:'))
  ) {
    return { type };
  }
  return { type: `source:${words.join(' ')}`, cppTemplateType: true };
}

// Copy C++ header imports and using-declarations from the source program
// when its emitted code still uses the same library and namespace.
function keepCppImports(program, { from, to }) {
  if (from !== 'cpp' || to !== 'cpp' || !program.imports?.length) {
    return program;
  }
  const imports = program.imports.flatMap((line) => {
    const include =
      /^#[ \t]*include[ \t]*(<[^>\r\n]+>|"[^"\r\n]+")([ \t]+\/\/.*)?$/u.exec(
        line
      );
    if (include) {
      return [`#include ${include[1]}${include[2] ?? ''}`];
    }
    return /^using (?:namespace [\p{L}\p{N}_]+|[\p{L}\p{N}_]+::[\p{L}\p{N}_]+)(?:::[\p{L}\p{N}_]+)*$/u.test(
      line
    )
      ? [`${line};`]
      : [];
  });
  return imports.length
    ? {
        ...program,
        libraryImports: [
          ...imports,
          ...(program.libraryImports ?? []).filter(
            (line) => !imports.includes(line)
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

export function adaptCppProgram(program, settings) {
  return keepCppFileScope(keepCppImports(program, settings), settings);
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
