import { expect, it } from 'test-anywhere';
import { createTranslator, reconstructConcrete } from '../src/index.js';
import { languageSyntax } from '../src/formal/languages.js';
import { tokenize } from '../src/formal/lexer.js';
import { parseProgram } from '../src/formal/parser.js';
import { meaningDifference } from '../src/meta/tree.js';
import { rocqLayouts } from '../../examples/runtime-headers/rocq-layout.mjs';

const translator = createTranslator();
const python = 'n = 2\nprint(n)\n';
const canonical = translator.translate(python, 'python', 'rocq');
const header = languageSyntax('rocq').header;
const variants = rocqLayouts(canonical);

it('reads token-equivalent Rocq runtime headers with native layout and comments', () => {
  const expected = translator.toMeta(python, 'python');
  for (const source of variants) {
    const actual = translator.toMeta(source, 'rocq');
    expect(meaningDifference(expected, actual)).toBe(undefined);
    expect(
      reconstructConcrete(parseProgram(source, languageSyntax('rocq')).syntax)
    ).toBe(source);
    const print = tokenize(source, languageSyntax('rocq')).find(
      (token) => token.value === 'print_line'
    );
    expect(print.line).toBe(
      source.slice(0, print.rawSpan[0]).split('\n').length
    );
    const partial = translator.translatePartial(source, 'rocq', 'rocq', {
      commentFrom: 'english',
      commentLanguage: 'russian',
    });
    expect(partial.complete).toBe(true);
    expect(partial.text).toBe(source.replace('number 😀', 'число 😀'));
  }
});

it('does not discard changed Rocq helpers or changed quoted runtime values', () => {
  for (const source of [
    canonical.replace('From Stdlib', 'FromStdlib'),
    canonical.replace('ascii_of_nat 10', 'ascii_of_nat 13'),
    canonical.replace('"true"', '" true "'),
    header.trimEnd().slice(0, -1),
  ]) {
    expect(() => translator.toMeta(source, 'rocq')).toThrow();
  }
});
