// The style a program is written in: where the brace that opens a block
// goes and how deep a block is indented. A style rewrites the lines of a
// translation (or of a program translated into its own language), so C#
// can be written with its traditional braces on lines of their own, or
// JavaScript indented by two spaces. The Rust twin is rust/src/style.rs.

import { tokenize } from '../formal/lexer.js';

export const braceStyles = ['same-line', 'next-line'];

// Whether the options ask for a style.
export const hasStyle = ({ braces, indent } = {}) =>
  braces !== undefined || indent !== undefined;

// The text of one indentation step: a number of spaces or a tab.
function indentUnit(indent) {
  if (indent === 'tab') {
    return '\t';
  }
  // A number, or the digits of one.
  const width =
    typeof indent === 'number' ||
    (typeof indent === 'string' && /^\d+$/.test(indent))
      ? Number(indent)
      : NaN;
  if (!Number.isInteger(width) || width < 1 || width > 16) {
    throw new Error(
      `Unsupported indent "${indent}": a number of spaces from 1 to 16 or "tab"`
    );
  }
  return ' '.repeat(width);
}

export function checkStyle({ braces, indent } = {}, syntax) {
  if (braces !== undefined && !braceStyles.includes(braces)) {
    throw new Error(
      `Unsupported brace style "${braces}": same-line or next-line`
    );
  }
  if (indent !== undefined) {
    indentUnit(indent);
  }
  // Go ends a statement at the end of a line, so `if x` followed by a line
  // with "{" alone does not compile.
  if (braces === 'next-line' && syntax?.id === 'go') {
    throw new Error('Go needs the opening brace on the line of its statement');
  }
}

// For each line of the text: whether it ends with the brace that opens a
// block, and whether it starts with a closing brace that the next word
// (else, catch, while) follows.
function braceLines(text, syntax) {
  const lines = new Map();
  const tokens = tokenize(text, {
    ...syntax,
    symbols: ['^', '~', ...(syntax.symbols ?? [])],
  }).filter((token) => token.type !== 'newline' && token.type !== 'end');
  tokens.forEach((token, index) => {
    const next = tokens[index + 1];
    const previous = tokens[index - 1];
    const line = lines.get(token.line) ?? {};
    if (
      token.type === 'symbol' &&
      token.value === '{' &&
      next?.line !== token.line &&
      previous?.line === token.line
    ) {
      line.opens = true;
    }
    if (
      token.type === 'symbol' &&
      token.value === '}' &&
      previous?.line !== token.line &&
      next?.line === token.line &&
      next.type === 'name'
    ) {
      line.continues = true;
    }
    lines.set(token.line, line);
  });
  return lines;
}

// The indentation of a line in steps of the emitter's unit and the spaces
// left over (the " *" of a block comment line).
function depthOf(leading, unit) {
  let depth = 0;
  let rest = leading;
  while (rest.startsWith(unit)) {
    depth += 1;
    rest = rest.slice(unit.length);
  }
  return { depth, rest };
}

// The text in the style, and for each line of the text (from 1) the line it
// starts at in the styled text.
export function applyStyle(text, syntax, options = {}) {
  checkStyle(options, syntax);
  const nextLine = options.braces === 'next-line' && syntax.blocks === 'braces';
  const braces = nextLine ? braceLines(text, syntax) : new Map();
  const written = syntax.id === 'go' ? '\t' : '    ';
  const unit =
    options.indent === undefined ? written : indentUnit(options.indent);
  const output = [];
  const starts = [];
  text.split('\n').forEach((line, index) => {
    starts.push(output.length + 1);
    const [leading] = line.match(/^[ \t]*/);
    const { depth, rest } = depthOf(leading, written);
    const indentation = unit.repeat(depth) + rest;
    let code = line.slice(leading.length).trimEnd();
    const { opens, continues } = braces.get(index + 1) ?? {};
    if (!code) {
      output.push(line && indentation);
      return;
    }
    if (continues) {
      output.push(`${indentation}}`);
      code = code.slice(1).trimStart();
    }
    if (opens) {
      output.push(`${indentation}${code.slice(0, -1).trimEnd()}`);
      code = '{';
    }
    output.push(`${indentation}${code}`);
  });
  return { text: output.join('\n'), starts };
}
