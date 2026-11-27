// Rule-based lexer. One set of token rules serves every language; the
// language description only decides which comment markers, quotes and
// layout rules (indentation, line ends) apply.

import { objectiveCRuntimeHeader } from './dialects/objc.js';
import { blockCommentEnd } from '../translation/comment-syntax.js';

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

// Text between quotes. Most languages escape with a backslash; Pascal, Ada,
// Fortran and Visual Basic write a quote inside text as two quotes instead,
// and keep backslashes as they are.
function readQuoted(
  source,
  start,
  quote,
  line,
  doubled = false,
  triple = false
) {
  const delimiter = triple ? quote.repeat(3) : quote;
  let index = start + delimiter.length;
  let raw = '';
  while (index < source.length) {
    if (source.startsWith(delimiter, index)) {
      if (!doubled || source[index + 1] !== quote) {
        break;
      }
      raw += quote;
      index += 2;
    } else if (source[index] === '\\' && !doubled) {
      raw += source.slice(index, index + 2);
      index += 2;
    } else {
      if (source[index] === '\n' && quote !== '`' && !triple) {
        throw new SyntaxError('Unterminated text literal', line);
      }
      raw += source[index];
      index += 1;
    }
  }
  if (index >= source.length) {
    throw new SyntaxError('Unterminated text literal', line);
  }
  return { raw, end: index + delimiter.length };
}

export function decodeEscapes(raw) {
  return raw.replace(/\\(u\{[0-9a-fA-F]+\}|.)/g, (_, code) =>
    code.startsWith('u{')
      ? String.fromCodePoint(parseInt(code.slice(2, -1), 16))
      : (escapes[code] ?? code)
  );
}

// Concrete syntax: the text of a comment keeps its inner whitespace. Only
// the one space that usually follows the marker and the spaces before the
// line end are dropped.
export function commentText(raw) {
  return raw.replace(/^ /, '').replace(/\s+$/, '');
}

// A block comment keeps its lines. Continuation lines lose the indentation
// of the comment itself, so they keep their place relative to it.
export function blockCommentText(raw, column) {
  const lines = raw.split('\n');
  const outdent = new RegExp(`^[ \\t]{0,${column}}`);
  const text = [
    lines[0],
    ...lines.slice(1).map((line) => line.replace(outdent, '')),
  ].join('\n');
  return lines.length > 1 ? commentText(text) : text.trim();
}

export function tokenize(source, syntax) {
  const tokens = new Lexer(source, syntax).run();
  if (
    syntax.id !== 'rocq' ||
    !syntax.header ||
    source.startsWith(syntax.header)
  ) {
    return tokens;
  }
  // Runtime recognition follows lexical tokens, so native layout and comments
  // may vary while names, operators and quoted values must remain identical.
  const expected = new Lexer(syntax.header, { ...syntax, header: undefined })
    .run()
    .filter((token) => !['newline', 'comment', 'end'].includes(token.type));
  let position = 0;
  const comments = [];
  for (const token of expected) {
    while (['newline', 'comment'].includes(tokens[position]?.type)) {
      if (tokens[position].type === 'comment') {
        comments.push(tokens[position]);
      }
      position += 1;
    }
    const actual = tokens[position];
    if (
      !actual ||
      ['type', 'value', 'quote', 'style', 'decoded'].some(
        (key) => actual[key] !== token[key]
      )
    ) {
      return tokens;
    }
    position += 1;
  }
  return [...comments, ...tokens.slice(position)];
}

// Reads one token kind at a time. Each reader returns true when it consumed
// input at the current position; the first reader that does wins.
class Lexer {
  constructor(source, syntax) {
    this.source = source;
    this.syntax = syntax;
    this.tokens = [];
    // PHP documents start in output mode; tagless code snippets keep their
    // existing implicit code mode. Markup cannot begin a PHP expression.
    this.phpOutside = syntax.id === 'php' && /^\s*</.test(source);
    this.index =
      !this.phpOutside && syntax.header && source.startsWith(syntax.header)
        ? syntax.header.length
        : 0;
    this.line = source.slice(0, this.index).split('\n').length;
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
      if (this.phpMode()) {
        continue;
      }
      const start = this.index;
      const first = this.tokens.length;
      this.readers.some((read) => read());
      for (const token of this.tokens.slice(first)) {
        token.rawSpan = [start, this.index];
      }
    }
    if (this.tokens.length && this.tokens.at(-1).type !== 'newline') {
      this.push('newline', '\n');
    }
    if (this.syntax.blocks === 'indentation') {
      this.placeBlocks(0);
    }
    this.push('end', '');
    return this.tokens;
  }

  // Code and literal output share block scope across PHP mode changes.
  // Strings/block comments consume their own contents before this is called.
  phpMode() {
    if (this.syntax.id !== 'php') {
      return false;
    }
    if (!this.phpOutside && this.source.startsWith('?>', this.index)) {
      const start = this.index;
      this.index += 2;
      // A close tag terminates a statement, including an echo shorthand.
      this.push('symbol', ';', { rawSpan: [start, this.index] });
      this.index += /^(?:\r\n|\n|\r)/.exec(this.rest())?.[0].length ?? 0;
      this.line += this.source.slice(start, this.index).split('\n').length - 1;
      this.phpOutside = true;
      return true;
    }
    if (!this.phpOutside) {
      return false;
    }
    const start = this.index;
    const opening = /<\?(?:php(?=[ \t\r\n]|$)|=)/gi;
    opening.lastIndex = start;
    const match = opening.exec(this.source);
    const stop = match?.index ?? this.source.length;
    if (stop > start) {
      this.push('inlineText', this.source.slice(start, stop), {
        rawSpan: [start, stop],
      });
      this.line += this.source.slice(start, stop).split('\n').length - 1;
      this.push('newline', '\n');
    }
    this.index = match ? stop + match[0].length : stop;
    if (match) {
      this.phpOutside = false;
      if (match[0] === '<?=') {
        this.push('name', 'echo', { rawSpan: [stop, this.index] });
      }
    }
    return true;
  }

  push(type, value, extra = {}) {
    this.tokens.push({ type, value, line: this.line, ...extra });
  }

  rest() {
    return this.source.slice(this.index);
  }

  // Offside rule: compare the width of a code line with the open blocks.
  // Empty lines and comment lines do not open or close blocks: a comment
  // line is placed when the next code line shows which block it is in.
  indent() {
    this.lineStart = false;
    const width = /^[ \t]*/.exec(this.rest())[0].length;
    const next = this.source[this.index + width];
    if (next === undefined || '\r\n'.includes(next) || this.depth > 0) {
      return;
    }
    if (this.startsComment(this.index + width)) {
      this.pending ??= [];
      this.pending.push({ at: this.tokens.length, width });
      return;
    }
    this.placeBlocks(width);
    if (width !== this.indentation.at(-1)) {
      throw new SyntaxError('Inconsistent indentation', this.line);
    }
  }

  startsComment(index) {
    const markers = [this.syntax.lineComment, this.syntax.blockComment?.[0]];
    return markers.some(
      (marker) => marker && this.source.startsWith(marker, index)
    );
  }

  // Open or close blocks up to a code line of this width. Comment lines
  // before it go into the new block when it opens one; when it closes
  // blocks, the comments indented deeper than it stay in the block they
  // follow, and the others go after the closed blocks.
  placeBlocks(width) {
    const pending = this.pending ?? [];
    this.pending = undefined;
    const start = pending[0]?.at ?? this.tokens.length;
    const comments = this.tokens.splice(start);
    let inside = comments.length;
    if (width <= this.indentation.at(-1)) {
      const outer = pending.find((comment) => comment.width <= width);
      inside = outer ? outer.at - start : comments.length;
    }
    if (width > this.indentation.at(-1)) {
      this.indentation.push(width);
      this.push('indent', width);
      inside = 0;
    }
    this.tokens.push(...comments.slice(0, inside));
    while (width < this.indentation.at(-1)) {
      this.indentation.pop();
      this.push('dedent', width);
    }
    this.tokens.push(...comments.slice(inside));
  }

  newline() {
    if (this.source[this.index] !== '\n') {
      return false;
    }
    const last = this.tokens.at(-1);
    if (this.depth === 0 && last && last.type !== 'newline') {
      this.push('newline', '\n', { blank: 0 });
    } else if (this.depth === 0 && last?.type === 'newline') {
      // Concrete syntax: count the empty lines between two statements.
      last.blank += 1;
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

  // The line comment marker here: Lua skips a first line that starts with
  // "#" (a #! line), and fixed-form Fortran comments out a line with C or *
  // in its first column (`C     Hello World`, not `c = 1`).
  commentMarker() {
    const { id, lineComment } = this.syntax;
    if (id === 'lua' && this.index === 0 && this.source[0] === '#') {
      return '#';
    }
    if (
      id === 'fortran' &&
      (this.index === 0 || this.source[this.index - 1] === '\n')
    ) {
      const line = this.source.slice(this.index, this.untilLineEnd());
      const fixed = /^([Cc*])(?![^ \t\r])(?![ \t]*[=(])/.exec(line);
      if (fixed) {
        return fixed[1];
      }
    }
    if (id === 'php' && this.source[this.index] === '#') {
      return '#';
    }
    return lineComment;
  }

  lineComment() {
    const marker = this.commentMarker();
    if (
      !this.source.startsWith(marker, this.index) ||
      (this.syntax.id === 'lua' &&
        this.source.startsWith('--[[', this.index)) ||
      // Bash: ${#a[@]} is the length of a, not a comment.
      (this.syntax.id === 'bash' && this.source[this.index - 1] === '{')
    ) {
      return false;
    }
    let stop = this.untilLineEnd();
    if (this.syntax.id === 'php') {
      const closing = this.source.indexOf('?>', this.index);
      if (closing >= 0 && closing < stop) {
        stop = closing;
      }
    }
    const start = this.index + marker.length;
    this.pushComment(commentText(this.source.slice(start, stop)), {
      span: [start, stop],
    });
    this.index = stop;
    return true;
  }

  // A comment after code on the same line stays a trailing comment.
  pushComment(text, extra = {}) {
    const last = this.tokens.at(-1);
    const trailing =
      last !== undefined &&
      last.line === this.line &&
      !['newline', 'indent', 'dedent'].includes(last.type);
    // A trailing comment keeps the spaces that separate it from the code.
    const gap = /[ \t]*$/.exec(this.source.slice(0, this.index))[0];
    this.push('comment', text, {
      ...extra,
      ...(trailing ? { trailing: gap || ' ' } : {}),
    });
  }

  // Columns from the start of the current line.
  column() {
    return this.index - (this.source.lastIndexOf('\n', this.index - 1) + 1);
  }

  blockComment() {
    const [open, close] = this.syntax.blockComment ?? [];
    if (!open || !this.source.startsWith(open, this.index)) {
      return false;
    }
    const scanned = blockCommentEnd(
      this.source,
      this.index,
      [open, close],
      this.syntax.nestedComments,
      this.syntax.commentStrings
    );
    if (!scanned.closed) {
      throw new SyntaxError('Unterminated comment', this.line);
    }
    const end = scanned.end - close.length;
    const text = this.source.slice(this.index + open.length, end);
    this.pushComment(blockCommentText(text, this.column()), {
      block: true,
      span: [this.index + open.length, end],
    });
    this.line += text.split('\n').length - 1;
    this.index = end + close.length;
    return true;
  }

  // Preprocessor lines such as #include <stdio.h>.
  directive() {
    // This known header alternative defines the same scalar type on both
    // runtimes. Arbitrary conditional code still requires preprocessing.
    if (
      this.syntax.id === 'objc' &&
      this.source.startsWith(objectiveCRuntimeHeader, this.index) &&
      /^(?:\r?\n|$)/.test(
        this.source.slice(this.index + objectiveCRuntimeHeader.length)
      )
    ) {
      this.push('directive', objectiveCRuntimeHeader);
      this.index += objectiveCRuntimeHeader.length;
      this.line += objectiveCRuntimeHeader.split('\n').length - 1;
      return true;
    }
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
    // A prefix such as Python's f or Nim's fmt marks an interpolated literal.
    const prefixed = (this.syntax.interpolation ?? []).find(
      ({ prefix }) =>
        prefix &&
        this.source.startsWith(prefix, this.index) &&
        this.syntax.quotes.includes(this.source[this.index + prefix.length])
    )?.prefix;
    if (!prefixed && !this.syntax.quotes.includes(character)) {
      return false;
    }
    const start = prefixed ? this.index + prefixed.length : this.index;
    const quote = this.source[start];
    const doubled = Boolean(this.syntax.doubledQuotes);
    const { raw, end } = readQuoted(
      this.source,
      start,
      quote,
      this.line,
      doubled,
      this.syntax.id === 'python' &&
        this.source.startsWith(quote.repeat(3), start)
    );
    const style = interpolationStyle(this.syntax, quote, prefixed);
    // Doubled quotes are already read, so the text has no escapes left.
    const identifier = this.syntax.id === 'sql' && quote === '"';
    this.push(identifier ? 'name' : 'text', raw, {
      quote,
      style,
      decoded: doubled,
    });
    this.line += raw.split('\n').length - 1;
    this.index = end;
    return true;
  }

  number() {
    const number = /^\d+(\.\d+)?([eE][+-]?\d+)?/.exec(this.rest());
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
  // Where "!" starts a comment (Fortran), it never ends a name. Letters of
  // every script make names ("сумма"); the span says where the name stands,
  // so identifiers can be renamed in place.
  name() {
    const pattern =
      this.syntax.lineComment === '!'
        ? /^[\p{Alphabetic}_][\p{Alphabetic}\p{N}_]*/u
        : /^[\p{Alphabetic}_][\p{Alphabetic}\p{N}_]*!?/u;
    const name = pattern.exec(this.rest());
    if (!name) {
      return false;
    }
    const value =
      name[0].endsWith('!') && this.source[this.index + name[0].length] === '='
        ? name[0].slice(0, -1)
        : name[0];
    this.push('name', this.syntax.id === 'sql' ? value.toLowerCase() : value, {
      span: [this.index, this.index + value.length],
    });
    this.index += value.length;
    return true;
  }

  // PHP's $ before variable names carries no meaning of its own.
  sigil() {
    if (
      this.syntax.variableSigil !== this.source[this.index] ||
      !/[\p{Alphabetic}_]/u.test(this.source[this.index + 1] ?? '')
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
