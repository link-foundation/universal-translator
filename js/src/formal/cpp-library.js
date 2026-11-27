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

// Copy C++ header imports and using-declarations from the source program
// when its emitted code still uses the same library and namespace.
export function keepCppImports(program, { from, to }) {
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
