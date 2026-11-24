// Rule-based lexer. One set of token rules serves every language; the
// language description only decides which comment markers, quotes and
// layout rules (indentation, line ends) apply.

const symbols = [
  '...', '..<', '..=', '===', '!==', '**', '//', '<<', '>>', '::', '->', '=>',
  ':=', '==', '!=', '~=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=',
  '/=', '%=', '..', '{', '}', '(', ')', '[', ']', ';', ',', '.', ':', '+', '-',
  '*', '/', '%', '<', '>', '=', '!', '&', '|', '?', '$', '#', '@', '\\',
];

const escapes = { n: '\n', t: '\t', r: '\r', '0': '\0', '\\': '\\', '"': '"', "'": "'", '`': '`', $: '$' };

export class SyntaxError extends Error {
  constructor(message, line) {
    super(`${message} (line ${line})`);
    this.line = line;
  }
}

function readQuoted(source, start, quote, line) {
  let index = start + 1;
  let raw = '';
  while (index < source.length && source[index] !== quote) {
    if (source[index] === '\\') {
      raw += source.slice(index, index + 2);
      index += 2;
    } else {
      if (source[index] === '\n' && quote !== '`') {
        throw new SyntaxError('Unterminated text literal', line);
      }
      raw += source[index];
      index += 1;
    }
  }
  if (index >= source.length) {
    throw new SyntaxError('Unterminated text literal', line);
  }
  return { raw, end: index + 1 };
}

export function decodeEscapes(raw) {
  return raw.replace(/\\(u\{[0-9a-fA-F]+\}|.)/g, (_, code) =>
    code.startsWith('u{')
      ? String.fromCodePoint(parseInt(code.slice(2, -1), 16))
      : (escapes[code] ?? code)
  );
}

// Text prefixes that turn a literal into an interpolated one.
const interpolationPrefixes = { f: 'braces', $: 'braces' };

export function tokenize(source, syntax) {
  const tokens = [];
  let index = 0;
  let line = 1;
  let lineStart = true;
  const indentation = [0];
  let depth = 0; // open brackets; newlines inside them are not significant
  const push = (type, value, extra = {}) => tokens.push({ type, value, line, ...extra });

  if (syntax.header && source.startsWith(syntax.header)) {
    index = syntax.header.length;
  }
  while (index < source.length) {
    const character = source[index];
    if (lineStart && syntax.blocks === 'indentation') {
      const match = /^[ \t]*/.exec(source.slice(index))[0];
      const rest = source[index + match.length];
      if (rest !== '\n' && rest !== '\r' && rest !== '#' && rest !== undefined && depth === 0) {
        const width = match.length;
        if (width > indentation.at(-1)) {
          indentation.push(width);
          push('indent', width);
        }
        while (width < indentation.at(-1)) {
          indentation.pop();
          push('dedent', width);
        }
        if (width !== indentation.at(-1)) {
          throw new SyntaxError('Inconsistent indentation', line);
        }
      }
      lineStart = false;
    }
    if (character === '\n') {
      if (depth === 0 && tokens.length && tokens.at(-1).type !== 'newline') {
        push('newline', '\n');
      }
      line += 1;
      index += 1;
      lineStart = true;
      continue;
    }
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (source.startsWith(syntax.lineComment, index) && !(syntax.id === 'lua' && source.startsWith('--[[', index))) {
      const end = source.indexOf('\n', index);
      const stop = end < 0 ? source.length : end;
      push('comment', source.slice(index + syntax.lineComment.length, stop).trim());
      index = stop;
      continue;
    }
    if (syntax.blockComment && source.startsWith(syntax.blockComment[0], index)) {
      const end = source.indexOf(syntax.blockComment[1], index + 2);
      if (end < 0) {
        throw new SyntaxError('Unterminated comment', line);
      }
      const text = source.slice(index + syntax.blockComment[0].length, end);
      push('comment', text.trim());
      line += text.split('\n').length - 1;
      index = end + syntax.blockComment[1].length;
      continue;
    }
    if (character === '#' && syntax.id !== 'python' && syntax.id !== 'ruby' && /^#\s*(include|import)/.test(source.slice(index))) {
      const end = source.indexOf('\n', index);
      push('directive', source.slice(index, end < 0 ? source.length : end).trim());
      index = end < 0 ? source.length : end;
      continue;
    }
    const prefix = interpolationPrefixes[character];
    const quoteAfterPrefix = prefix && syntax.quotes.includes(source[index + 1]);
    if (syntax.quotes.includes(character) || quoteAfterPrefix) {
      const start = quoteAfterPrefix ? index + 1 : index;
      const quote = source[start];
      const { raw, end } = readQuoted(source, start, quote, line);
      const style = interpolationStyle(syntax, quote, quoteAfterPrefix ? character : '');
      push('text', raw, { quote, style });
      line += raw.split('\n').length - 1;
      index = end;
      continue;
    }
    const number = /^\d+(\.\d+)?/.exec(source.slice(index));
    if (number) {
      push('number', number[0]);
      index += number[0].length;
      continue;
    }
    const name = /^[A-Za-z_][A-Za-z0-9_]*!?/.exec(source.slice(index));
    if (name) {
      let value = name[0];
      if (value.endsWith('!') && source[index + value.length] === '=') {
        value = value.slice(0, -1);
      }
      push('name', value);
      index += value.length;
      continue;
    }
    if (syntax.variableSigil === character && /[A-Za-z_]/.test(source[index + 1] ?? '')) {
      index += 1;
      continue;
    }
    const symbol = symbols.find((candidate) => source.startsWith(candidate, index));
    if (!symbol) {
      throw new SyntaxError(`Unexpected character "${character}"`, line);
    }
    // Newlines inside parentheses and brackets do not end a statement.
    // Braces delimit blocks, so their contents keep line structure.
    if (symbol === '(' || symbol === '[') {
      depth += 1;
    } else if ((symbol === ')' || symbol === ']') && depth > 0) {
      depth -= 1;
    }
    push('symbol', symbol);
    index += symbol.length;
  }
  if (tokens.length && tokens.at(-1).type !== 'newline') {
    push('newline', '\n');
  }
  while (indentation.length > 1) {
    indentation.pop();
    push('dedent', 0);
  }
  push('end', '');
  return tokens;
}

function interpolationStyle(syntax, quote, prefix) {
  if (prefix === 'f' && syntax.id === 'python') return 'braces';
  if (prefix === '$' && syntax.id === 'csharp') return 'braces';
  if (quote === '`' && syntax.id.endsWith('script')) return 'dollar-braces';
  if (quote === '"' && syntax.id === 'ruby') return 'hash-braces';
  if (quote === '"' && syntax.id === 'kotlin') return 'dollar';
  if (quote === '"' && syntax.id === 'php') return 'dollar';
  if (quote === '"' && syntax.id === 'swift') return 'backslash-parentheses';
  return 'plain';
}
