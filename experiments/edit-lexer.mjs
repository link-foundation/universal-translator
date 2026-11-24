// One-off source edit for the lexer: data-driven interpolation, extra
// symbols and number suffixes.
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'js/src/grammar/lexer.js';
let source = readFileSync(path, 'utf8');
const replace = (from, to) => {
  if (!source.includes(from)) {
    throw new Error(`missing: ${from.slice(0, 60)}`);
  }
  source = source.replace(from, to);
};

replace(
  `// Text prefixes that turn a literal into an interpolated one.
const interpolationPrefixes = { f: 'braces', $: 'braces' };

`,
  ''
);
replace(
  `      () => this.lineComment(),
      () => this.blockComment(),`,
  `      () => this.blockComment(),
      () => this.lineComment(),`
);
replace(
  `    this.depth = 0; // open brackets; newlines inside them are not significant
`,
  `    this.depth = 0; // open brackets; newlines inside them are not significant
    this.symbols = [...(syntax.symbols ?? []), ...symbols];
`
);
replace(
  `    const character = this.source[this.index];
    const prefixed =
      Boolean(interpolationPrefixes[character]) &&
      this.syntax.quotes.includes(this.source[this.index + 1]);
    if (!prefixed && !this.syntax.quotes.includes(character)) {
      return false;
    }
    const start = prefixed ? this.index + 1 : this.index;
    const quote = this.source[start];
    const { raw, end } = readQuoted(this.source, start, quote, this.line);
    const style = interpolationStyle(
      this.syntax,
      quote,
      prefixed ? character : ''
    );`,
  `    const character = this.source[this.index];
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
    );`
);
replace(
  `    const number = /^\\d+(\\.\\d+)?/.exec(this.rest());
    if (!number) {
      return false;
    }
    this.push('number', number[0]);
    this.index += number[0].length;`,
  `    const number = /^\\d+(\\.\\d+)?/.exec(this.rest());
    if (!number) {
      return false;
    }
    this.push('number', number[0]);
    this.index += number[0].length;
    // R writes integers as 1L.
    const suffix = this.syntax.numberSuffix;
    if (suffix && this.source.startsWith(suffix, this.index)) {
      this.index += suffix.length;
    }`
);
replace(
  `    const symbol = symbols.find((candidate) =>`,
  `    const symbol = this.symbols.find((candidate) =>`
);
const tail = source.indexOf('function interpolationStyle(');
source = `${source.slice(0, tail)}// Which interpolation style a text literal uses, from the language's
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
`;
writeFileSync(path, source);
