import { expect, it } from 'test-anywhere';
import { createTranslator, reconstructConcrete } from '../src/index.js';
import { parseProgram } from '../src/formal/parser.js';
import { languageSyntax } from '../src/formal/languages.js';
import { meaningDifference } from '../src/meta/tree.js';
import { phpOutputCases } from '../../examples/runtime-headers/php-output.mjs';

const translator = createTranslator();
it('retains PHP output whitespace outside its opening and closing tags', () => {
  for (const [source, expected] of phpOutputCases) {
    const meta = translator.toMeta(source, 'php');
    const writes = meta.main.statements.filter(
      (statement) => statement.kind === 'Print'
    );
    expect(
      writes
        .map((write) => write.value.value + (write.newline ? '\n' : ''))
        .join('')
    ).toBe(expected);
    const python = translator.translate(source, 'php', 'python');
    expect(meaningDifference(meta, translator.toMeta(python, 'python'))).toBe(
      undefined
    );
    expect(
      reconstructConcrete(parseProgram(source, languageSyntax('php')).syntax)
    ).toBe(source);
    const partial = translator.translatePartial(source, 'php', 'php', {
      commentLanguage: 'russian',
      commentFrom: 'english',
    });
    expect(partial.complete).toBe(true);
    expect(partial.text).toBe(source.replace('number', 'число'));
  }
});
