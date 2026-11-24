// Rule-based lexer. One set of token rules serves every language; the
// language description only decides which comment markers, quotes and
// layout rules (indentation, line ends) apply.

const symbols = [
  '...',
  '..<',
  '..=',
  '===',
  '!==',
  '**',
  '//',
  '<<',
  '>>',
  '::',
  '->',
  '=>',
  ':=',
  '==',
  '!=',
  '~=',
  '<=',
  '>=',
  '&&',
  '||',
  '++',
  '--',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '..',
  '{',
  '}',
  '(',
  ')',
  '[',
  ']',
  ';',
  ',',
  '.',
  ':',
  '+',
  '-',
  '*',
  '/',
  '%',
  '<',
  '>',
  '=',
  '!',
  '&',
  '|',
  '?',
  '$',
  '#',
  '@',
  '\\',
];

const escapes = {
  n: '\n',
  t: '\t',
  r: '\r',
  0: '\0',
  '\\': '\\',
  '"': '"',
  "'": "'",
  '`': '`',
  $: '$',
};

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

export function tokenize(source, syntax) {
  return new Lexer(source, syntax).run();
}

// Reads one token kind at a time. Each reader returns true when it consumed
// input at the current position; the first reader that does wins.
class Lexer {
  constructor(source, syntax) {
    this.source = source;
    this.syntax = syntax;
    this.tokens = [];
    this.index =
      syntax.header && source.startsWith(syntax.header)
        ? syntax.header.length
        : 0;
    this.line = 1;
    this.lineStart = true;
    this.indentation = [0];
    this.depth = 0; // open brackets; newlines inside them are not significant
    this.symbols = [...(syntax.symbols ?? []), ...symbols];
    this.readers = [
      () => this.newline(),
      () => this.space(),
      () => this.blockComment(),
      () => this.lineComment(),
      () => this.directive(),
      () => this.text(),
      () => this.number(),
      () => this.name(),
      () => this.sigil(),
      () => this.symbol(),
    ];
  }

  run() {
    while (this.index < this.source.length) {
      if (this.lineStart && this.syntax.blocks === 'indentation') {
        this.indent();
      }
      this.readers.some((read) => read());
    }
    if (this.tokens.length && this.tokens.at(-1).type !== 'newline') {
      this.push('newline', '\n');
    }
    while (this.indentation.length > 1) {
      this.indentation.pop();
      this.push('dedent', 0);
    }
    this.push('end', '');
    return this.tokens;
  }

  push(type, value, extra = {}) {
    this.tokens.push({ type, value, line: this.line, ...extra });
  }

  rest() {
    return this.source.slice(this.index);
  }

  // Offside rule: compare the width of a code line with the open blocks.
  indent() {
    this.lineStart = false;
    const width = /^[ \t]*/.exec(this.rest())[0].length;
    const next = this.source[this.index + width];
    if (next === undefined || '\r\n#'.includes(next) || this.depth > 0) {
      return;
    }
    if (width > this.indentation.at(-1)) {
      this.indentation.push(width);
      this.push('indent', width);
    }
    while (width < this.indentation.at(-1)) {
      this.indentation.pop();
      this.push('dedent', width);
    }
    if (width !== this.indentation.at(-1)) {
      throw new SyntaxError('Inconsistent indentation', this.line);
    }
  }

  newline() {
    if (this.source[this.index] !== '\n') {
      return false;
    }
    const last = this.tokens.at(-1);
    if (this.depth === 0 && last && last.type !== 'newline') {
      this.push('newline', '\n');
    }
    this.line += 1;
    this.index += 1;
    this.lineStart = true;
    return true;
  }

  space() {
    if (!/\s/.test(this.source[this.index])) {
      return false;
    }
    this.index += 1;
    return true;
  }

  // Text up to the end of the line, or of the source.
  untilLineEnd() {
    const end = this.source.indexOf('\n', this.index);
    return end < 0 ? this.source.length : end;
  }

  lineComment() {
    const marker = this.syntax.lineComment;
    if (
      !this.source.startsWith(marker, this.index) ||
      (this.syntax.id === 'lua' && this.source.startsWith('--[[', this.index))
    ) {
      return false;
    }
    const stop = this.untilLineEnd();
    this.push(
      'comment',
      this.source.slice(this.index + marker.length, stop).trim()
    );
    this.index = stop;
    return true;
  }

  blockComment() {
    const [open, close] = this.syntax.blockComment ?? [];
    if (!open || !this.source.startsWith(open, this.index)) {
      return false;
    }
    const end = this.source.indexOf(close, this.index + open.length);
    if (end < 0) {
      throw new SyntaxError('Unterminated comment', this.line);
    }
    const text = this.source.slice(this.index + open.length, end);
    this.push('comment', text.trim());
    this.line += text.split('\n').length - 1;
    this.index = end + close.length;
    return true;
  }

  // Preprocessor lines such as #include <stdio.h>.
  directive() {
    if (
      this.syntax.lineComment === '#' ||
      !/^#\s*(include|import)/.test(this.rest())
    ) {
      return false;
    }
    const stop = this.untilLineEnd();
    this.push('directive', this.source.slice(this.index, stop).trim());
    this.index = stop;
    return true;
  }

  text() {
    const character = this.source[this.index];
    const prefixed = (this.syntax.interpolation ?? []).some(
      ({ prefix }) =>
        prefix === character &&
        this.syntax.quotes.includes(this.source[this.index + 1])
    );
    if (!prefixed && !this.syntax.quotes.includes(character)) {
      return false;
    }
    const start = prefixed ? this.index + 1 : this.index;
    const quote = this.source[start];
    const { raw, end } = readQuoted(this.source, start, quote, this.line);
    const style = interpolationStyle(
      this.syntax,
      quote,
      prefixed ? character : undefined
    );
    this.push('text', raw, { quote, style });
    this.line += raw.split('\n').length - 1;
    this.index = end;
    return true;
  }

  number() {
    const number = /^\d+(\.\d+)?/.exec(this.rest());
    if (!number) {
      return false;
    }
    this.push('number', number[0]);
    this.index += number[0].length;
    // R writes integers as 1L and Scala long ones.
    const suffix = this.syntax.numberSuffix ?? this.syntax.longSuffix;
    if (suffix && this.source.startsWith(suffix, this.index)) {
      this.index += suffix.length;
    }
    return true;
  }

  // Names, including Rust macro names such as println! (but not "x != y").
  name() {
    const name = /^[A-Za-z_][A-Za-z0-9_]*!?/.exec(this.rest());
    if (!name) {
      return false;
    }
    const value =
      name[0].endsWith('!') && this.source[this.index + name[0].length] === '='
        ? name[0].slice(0, -1)
        : name[0];
    this.push('name', value);
    this.index += value.length;
    return true;
  }

  // PHP's $ before variable names carries no meaning of its own.
  sigil() {
    if (
      this.syntax.variableSigil !== this.source[this.index] ||
      !/[A-Za-z_]/.test(this.source[this.index + 1] ?? '')
    ) {
      return false;
    }
    this.index += 1;
    return true;
  }

  symbol() {
    const symbol = this.symbols.find((candidate) =>
      this.source.startsWith(candidate, this.index)
    );
    if (!symbol) {
      throw new SyntaxError(
        `Unexpected character "${this.source[this.index]}"`,
        this.line
      );
    }
    // Newlines inside parentheses and brackets do not end a statement.
    // Braces delimit blocks, so their contents keep line structure.
    if (symbol === '(' || symbol === '[') {
      this.depth += 1;
    } else if ((symbol === ')' || symbol === ']') && this.depth > 0) {
      this.depth -= 1;
    }
    this.push('symbol', symbol);
    this.index += symbol.length;
    return true;
  }
}

// Which interpolation style a text literal uses, from the language's
// interpolation table: each entry names a quote, an optional prefix such as
// Python's f, and the style. Literals that match no entry are plain text.
function interpolationStyle(syntax, quote, prefix) {
  const entry = (syntax.interpolation ?? []).find(
    (candidate) =>
      candidate.prefix === prefix &&
      (candidate.quote === undefined || candidate.quote === quote)
  );
  return entry?.style ?? 'plain';
}
