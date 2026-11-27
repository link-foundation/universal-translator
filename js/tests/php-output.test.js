import { expect, it } from 'test-anywhere';
import { createTranslator, reconstructConcrete } from '../src/index.js';
import { parseProgram } from '../src/formal/parser.js';
import { languageSyntax } from '../src/formal/languages.js';
import { meaningDifference } from '../src/meta/tree.js';
import { phpOutputCases } from '../../examples/runtime-headers/php-output.mjs';
import { phpModeCases } from '../../examples/runtime-headers/php-modes.mjs';
import { tokenize } from '../src/formal/lexer.js';

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

it('composes PHP markup, repeated sections, short echoes and shared block scopes', () => {
  for (const [source] of phpModeCases) {
    const meta = translator.toMeta(source, 'php');
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
    expect(partial.text).toBe(
      source
        .replace('// number ?>', '// число ?>')
        .replace('# number ?>', '# число ?>')
        .replace('/* ?> number */', '/* ?> число */')
    );
    for (const token of tokenize(source, languageSyntax('php'))) {
      if (token.rawSpan) {
        expect(token.line).toBe(
          source.slice(0, token.rawSpan[0]).split('\n').length
        );
      }
    }
  }
});

it('keeps tagless PHP snippets and strings containing tag text in code mode', () => {
  for (const source of [
    'echo "<?php ?>";',
    'echo "<?= 2 ?>";',
    '$x = 2; echo $x;',
  ]) {
    const meta = translator.toMeta(source, 'php');
    const document = translator.toMeta(`<?php ${source}`, 'php');
    expect(meaningDifference(meta, document)).toBe(undefined);
  }
});

it('writes PHP comments containing closing tags without switching to output mode', () => {
  for (const comment of ['?> number', '*/ ?> number', 'first ?>\nsecond */']) {
    const source = `${comment
      .split('\n')
      .map((line) => `# ${line}`)
      .join('\n')}\nprint("ok")\n`;
    const php = translator.translate(source, 'python', 'php');
    expect(php).toContain('/* ');
    expect(php).not.toContain('// ?>');
    expect(
      meaningDifference(
        translator.toMeta(source, 'python'),
        translator.toMeta(php, 'php')
      )
    ).toBe(undefined);
  }
});

it('maps literal PHP markup and code to distinct UTF-8 output regions', () => {
  const source = '<b>😀</b><?php echo "ok" ?>\r\n<footer>end</footer>';
  const result = translator.translatePartial(source, 'php', 'python', {
    layout: 'target',
  });
  const spelling = (text, span) =>
    Buffer.from(text).subarray(span.start, span.end).toString();
  expect(result.complete).toBe(true);
  expect(result.lineMap).toEqual([
    [0, 0],
    [0, 1],
    [1, 2],
  ]);
  for (const markup of ['<b>😀</b>', '<footer>end</footer>']) {
    expect(
      result.regionMap.some(
        (pair) =>
          spelling(source, pair.source) === markup &&
          spelling(result.text, pair.target).includes(markup)
      )
    ).toBe(true);
  }
});
